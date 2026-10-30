"""Manage company-scoped pipeline stages."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit.service import record_audit
from app.common.exceptions import AppError, ErrorCode
from app.core.logging import log_event
from app.leads.models import Lead
from app.organization.models import Company
from app.pipeline.models import PipelineStage
from app.pipeline.schemas import (
    CreatePipelineStageRequest,
    DeletePipelineStageRequest,
    PipelineStageListData,
    ReorderPipelineStagesRequest,
    UpdatePipelineStageRequest,
    is_valid_key,
    slug_key,
    to_stage_public,
)
from app.roles.service import RoleName
from app.users.models import User
from app.users.service import is_platform_admin

logger = logging.getLogger("app.pipeline")

_MANAGE_ROLES = frozenset({RoleName.SUPER_ADMIN, RoleName.BUSINESS_OWNER})
_READ_ROLES = frozenset(
    {RoleName.SUPER_ADMIN, RoleName.BUSINESS_OWNER, RoleName.SALESPERSON, RoleName.MARKETING}
)
_LEGACY_STATUS = {
    "new": "new",
    "New": "new",
    "contacted": "contacted",
    "Contacted": "contacted",
    "in_progress": "in_progress",
    "In Progress": "in_progress",
    "qualified": "qualified",
    "Qualified": "qualified",
    "won": "won",
    "Won": "won",
    "lost": "lost",
    "Lost": "lost",
    "nurture": "nurture",
    "Nurture": "nurture",
    "unqualified": "lost",
}


def _role_names(user: User) -> set[str]:
    return {link.role.name for link in user.user_roles}


def _forbidden() -> AppError:
    return AppError(ErrorCode.FORBIDDEN, "You do not have permission to perform this action.", 403)


def _not_found(message: str = "Stage not found.") -> AppError:
    return AppError(ErrorCode.NOT_FOUND, message, 404)


def _validation(field: str, code: str, message: str) -> AppError:
    return AppError(
        ErrorCode.VALIDATION_ERROR,
        message,
        422,
        details=[{"field": field, "code": code, "message": message}],
    )


def _require_reader(user: User) -> None:
    if not _role_names(user) & _READ_ROLES:
        raise _forbidden()


def _require_manager(user: User) -> None:
    if not _role_names(user) & _MANAGE_ROLES:
        raise _forbidden()


def resolve_company_id(db: Session, actor: User, requested: uuid.UUID | None) -> uuid.UUID:
    if is_platform_admin(actor):
        company_id = actor.company_id if requested is None else requested
        if company_id is None:
            raise _validation("company_id", "REQUIRED", "Company is required.")
        company = db.get(Company, company_id)
        if company is None:
            raise _validation("company_id", "UNKNOWN_COMPANY", "Company not found.")
        return company_id
    if actor.company_id is None:
        raise _forbidden()
    if requested is not None and requested != actor.company_id:
        raise _forbidden()
    return actor.company_id


def canonicalize_status(value: str) -> str:
    return _LEGACY_STATUS.get(value, value.strip().lower().replace(" ", "_")[:40])


DEFAULT_STAGES: tuple[tuple[str, str, str, bool, bool, bool], ...] = (
    ("new", "New", "#93c5fd", True, False, False),
    ("contacted", "Contacted", "#60a5fa", False, False, False),
    ("in_progress", "In Progress", "#f59e0b", False, False, False),
    ("qualified", "Qualified", "#34d399", False, False, False),
    ("won", "Won", "#10b981", False, True, False),
    ("lost", "Lost", "#f87171", False, False, True),
    ("nurture", "Nurture", "#a78bfa", False, False, False),
)


def ensure_default_stages(db: Session, company_id: uuid.UUID) -> None:
    exists = db.scalar(
        select(PipelineStage.id).where(PipelineStage.company_id == company_id).limit(1)
    )
    if exists is not None:
        return
    now = datetime.now(UTC)
    for index, (key, label, color, is_entry, is_won, is_lost) in enumerate(DEFAULT_STAGES, start=1):
        db.add(
            PipelineStage(
                company_id=company_id,
                key=key,
                label=label,
                color=color,
                sort_order=index,
                is_entry=is_entry,
                is_won=is_won,
                is_lost=is_lost,
                created_at=now,
                updated_at=now,
            )
        )
    db.flush()


def entry_stage_key(db: Session, company_id: uuid.UUID) -> str:
    ensure_default_stages(db, company_id)
    key = db.scalar(
        select(PipelineStage.key)
        .where(PipelineStage.company_id == company_id, PipelineStage.is_entry.is_(True))
        .order_by(PipelineStage.sort_order)
        .limit(1)
    )
    if key:
        return key
    first = db.scalar(
        select(PipelineStage.key)
        .where(PipelineStage.company_id == company_id)
        .order_by(PipelineStage.sort_order)
        .limit(1)
    )
    return first or "new"


def assert_stage_key(db: Session, company_id: uuid.UUID, status: str) -> str:
    ensure_default_stages(db, company_id)
    key = canonicalize_status(status)
    exists = db.scalar(
        select(PipelineStage.id).where(
            PipelineStage.company_id == company_id,
            PipelineStage.key == key,
        )
    )
    if exists is None:
        raise _validation("status", "UNKNOWN_STAGE", "Choose a valid pipeline stage.")
    return key


def stage_keys_for_company(db: Session, company_id: uuid.UUID) -> set[str]:
    return set(
        db.scalars(select(PipelineStage.key).where(PipelineStage.company_id == company_id)).all()
    )


def _lead_counts(db: Session, company_id: uuid.UUID) -> dict[str, int]:
    rows = db.execute(
        select(Lead.status, func.count())
        .where(Lead.company_id == company_id, Lead.is_deleted.is_(False))
        .group_by(Lead.status)
    ).all()
    counts: dict[str, int] = {}
    for status, count in rows:
        key = canonicalize_status(str(status))
        counts[key] = counts.get(key, 0) + int(count)
    return counts


def list_stages(
    db: Session,
    actor: User,
    company_id: uuid.UUID | None,
) -> PipelineStageListData:
    _require_reader(actor)
    resolved = resolve_company_id(db, actor, company_id)
    ensure_default_stages(db, resolved)
    db.commit()
    stages = list(
        db.scalars(
            select(PipelineStage)
            .where(PipelineStage.company_id == resolved)
            .order_by(PipelineStage.sort_order, PipelineStage.label)
        ).all()
    )
    counts = _lead_counts(db, resolved)
    return PipelineStageListData(
        items=[to_stage_public(stage, counts.get(stage.key, 0)) for stage in stages],
        company_id=str(resolved),
    )


def _unique_key(db: Session, company_id: uuid.UUID, label: str) -> str:
    base = slug_key(label)
    if not is_valid_key(base):
        base = "stage"
    candidate = base
    index = 2
    while True:
        exists = db.scalar(
            select(PipelineStage.id).where(
                PipelineStage.company_id == company_id,
                PipelineStage.key == candidate,
            )
        )
        if exists is None:
            return candidate
        candidate = f"{base}_{index}"[:40]
        index += 1


def _clear_entry(db: Session, company_id: uuid.UUID, keep_id: uuid.UUID | None = None) -> None:
    stmt = (
        update(PipelineStage)
        .where(PipelineStage.company_id == company_id, PipelineStage.is_entry.is_(True))
        .values(is_entry=False, updated_at=datetime.now(UTC))
    )
    if keep_id is not None:
        stmt = stmt.where(PipelineStage.id != keep_id)
    db.execute(stmt)


def _next_sort(db: Session, company_id: uuid.UUID) -> int:
    current = db.scalar(
        select(func.coalesce(func.max(PipelineStage.sort_order), 0)).where(
            PipelineStage.company_id == company_id
        )
    )
    return int(current or 0) + 1


def create_stage(
    db: Session,
    actor: User,
    payload: CreatePipelineStageRequest,
    ip_address: str | None,
) -> PipelineStage:
    _require_manager(actor)
    company_id = resolve_company_id(db, actor, payload.company_id)
    now = datetime.now(UTC)
    if payload.is_entry:
        _clear_entry(db, company_id)
    stage = PipelineStage(
        company_id=company_id,
        key=_unique_key(db, company_id, payload.label),
        label=payload.label,
        color=payload.color,
        sort_order=_next_sort(db, company_id),
        is_entry=payload.is_entry,
        is_won=payload.is_won,
        is_lost=payload.is_lost,
        created_at=now,
        updated_at=now,
    )
    db.add(stage)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppError(ErrorCode.CONFLICT, "A stage with this key already exists.", 409) from None
    record_audit(
        db,
        action="pipeline_stage_created",
        actor_id=actor.id,
        target_type="pipeline_stage",
        target_id=stage.id,
        context={"key": stage.key, "label": stage.label, "company_id": str(company_id)},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(stage)
    log_event(logger, "pipeline_stage_created", actor_id=str(actor.id), stage_id=str(stage.id))
    return stage


def update_stage(
    db: Session,
    actor: User,
    stage_id: uuid.UUID,
    payload: UpdatePipelineStageRequest,
    ip_address: str | None,
) -> PipelineStage:
    _require_manager(actor)
    stage = db.get(PipelineStage, stage_id)
    if stage is None:
        raise _not_found()
    resolve_company_id(db, actor, stage.company_id)
    fields = payload.model_fields_set
    if not fields:
        raise _validation("request", "REQUIRED", "Provide at least one field to update.")
    if "label" in fields and payload.label is not None:
        stage.label = payload.label
    if "color" in fields and payload.color is not None:
        stage.color = payload.color
    if "is_won" in fields and payload.is_won is not None:
        stage.is_won = payload.is_won
    if "is_lost" in fields and payload.is_lost is not None:
        stage.is_lost = payload.is_lost
    if "is_entry" in fields and payload.is_entry is not None:
        if payload.is_entry:
            _clear_entry(db, stage.company_id, keep_id=stage.id)
        stage.is_entry = payload.is_entry
    stage.updated_at = datetime.now(UTC)
    record_audit(
        db,
        action="pipeline_stage_updated",
        actor_id=actor.id,
        target_type="pipeline_stage",
        target_id=stage.id,
        context={"fields": sorted(fields)},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(stage)
    return stage


def reorder_stages(
    db: Session,
    actor: User,
    payload: ReorderPipelineStagesRequest,
    ip_address: str | None,
) -> PipelineStageListData:
    _require_manager(actor)
    company_id = resolve_company_id(db, actor, payload.company_id)
    stages = list(
        db.scalars(select(PipelineStage).where(PipelineStage.company_id == company_id)).all()
    )
    by_id = {stage.id: stage for stage in stages}
    if set(payload.stage_ids) != set(by_id):
        raise _validation("stage_ids", "MISMATCH", "Send every stage id for this company exactly once.")
    now = datetime.now(UTC)
    for index, stage_id in enumerate(payload.stage_ids, start=1):
        stage = by_id[stage_id]
        stage.sort_order = index
        stage.updated_at = now
    record_audit(
        db,
        action="pipeline_stages_reordered",
        actor_id=actor.id,
        target_type="company",
        target_id=company_id,
        context={"order": [str(item) for item in payload.stage_ids]},
        ip_address=ip_address,
    )
    db.commit()
    return list_stages(db, actor, company_id)


def delete_stage(
    db: Session,
    actor: User,
    stage_id: uuid.UUID,
    payload: DeletePipelineStageRequest | None,
    ip_address: str | None,
) -> uuid.UUID:
    _require_manager(actor)
    stage = db.get(PipelineStage, stage_id)
    if stage is None:
        raise _not_found()
    company_id = resolve_company_id(db, actor, stage.company_id)
    remaining = (
        db.scalar(
            select(func.count()).select_from(PipelineStage).where(
                PipelineStage.company_id == company_id,
                PipelineStage.id != stage.id,
            )
        )
        or 0
    )
    if remaining < 1:
        raise AppError(ErrorCode.CONFLICT, "Keep at least one pipeline stage.", 409)
    lead_count = (
        db.scalar(
            select(func.count()).select_from(Lead).where(
                Lead.company_id == company_id,
                Lead.is_deleted.is_(False),
                Lead.status == stage.key,
            )
        )
        or 0
    )
    move_key = None if payload is None else payload.move_to_stage_key
    if lead_count > 0:
        if not move_key:
            raise AppError(
                ErrorCode.CONFLICT,
                f"{lead_count} lead(s) still use this stage. Move them first or send move_to_stage_key.",
                409,
            )
        move_key = canonicalize_status(move_key)
        if move_key == stage.key:
            raise _validation("move_to_stage_key", "SAME_STAGE", "Choose a different stage.")
        target = db.scalar(
            select(PipelineStage).where(
                PipelineStage.company_id == company_id,
                PipelineStage.key == move_key,
            )
        )
        if target is None:
            raise _validation("move_to_stage_key", "UNKNOWN_STAGE", "Choose a valid pipeline stage.")
        db.execute(
            update(Lead)
            .where(
                Lead.company_id == company_id,
                Lead.is_deleted.is_(False),
                Lead.status == stage.key,
            )
            .values(status=move_key, updated_at=datetime.now(UTC))
        )
    was_entry = stage.is_entry
    db.delete(stage)
    if was_entry:
        first = db.scalar(
            select(PipelineStage)
            .where(PipelineStage.company_id == company_id)
            .order_by(PipelineStage.sort_order)
            .limit(1)
        )
        if first is not None:
            first.is_entry = True
            first.updated_at = datetime.now(UTC)
    record_audit(
        db,
        action="pipeline_stage_deleted",
        actor_id=actor.id,
        target_type="pipeline_stage",
        target_id=stage_id,
        context={"key": stage.key, "moved_to": move_key},
        ip_address=ip_address,
    )
    db.commit()
    return company_id
