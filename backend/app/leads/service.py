"""Lead use cases. Visibility follows the caller's company and ownership scope."""

import logging
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.access.scope import record_is_in_scope, resolve_record_scope
from app.audit.service import record_audit
from app.common.exceptions import AppError, ErrorCode
from app.core.logging import log_event
from app.lead_fields.service import normalize_extra_values
from app.leads.models import Lead
from app.leads.schemas import CreateLeadRequest, UpdateLeadRequest, normalize_priority, normalize_status
from app.pipeline.service import assert_stage_key, entry_stage_key

_PRIORITY_FILTER_VALUES: dict[str, tuple[str, ...]] = {
    "high": ("high", "Hot"),
    "medium": ("medium", "Warm"),
    "low": ("low", "Cold"),
}
_STATUS_FILTER_VALUES: dict[str, tuple[str, ...]] = {
    "new": ("new", "New"),
    "contacted": ("contacted", "Contacted"),
    "in_progress": ("in_progress", "In Progress"),
    "qualified": ("qualified", "Qualified"),
    "won": ("won", "Won"),
    "lost": ("lost", "Lost", "unqualified"),
    "nurture": ("nurture", "Nurture"),
}
from app.organization.models import ACTIVE, Company, Project
from app.permissions.service import get_permission_keys
from app.roles.service import RoleName
from app.team.service import project_ids_for_member
from app.users.models import User
from app.users.service import is_platform_admin

logger = logging.getLogger("app.leads")
_MOBILE = re.compile(r"^\+?[0-9][0-9\s\-()]{7,18}$")
ASSIGN_PERMISSION = "leads.assign"


@dataclass(frozen=True)
class LeadFilters:
    search: str | None = None
    status: str | None = None
    owner_id: uuid.UUID | None = None
    source: str | None = None
    priority: str | None = None
    next_followup_on: date | None = None
    project_id: uuid.UUID | None = None


def _validation(field: str, code: str, message: str) -> AppError:
    return AppError(
        ErrorCode.VALIDATION_ERROR,
        message,
        422,
        details=[{"field": field, "code": code, "message": message}],
    )


def _not_found() -> AppError:
    return AppError(ErrorCode.NOT_FOUND, "Lead not found.", 404)


def _clean_mobile(value: str | None, field: str) -> str | None:
    if value is None:
        return None
    digits = "".join(character for character in value if character.isdigit())
    if _MOBILE.fullmatch(value) is None or not 8 <= len(digits) <= 15:
        raise _validation(field, "INVALID_MOBILE", "Enter a valid mobile number.")
    return value


def _active_company(db: Session, company_id: uuid.UUID) -> Company:
    company = db.get(Company, company_id)
    if company is None:
        raise _validation("company_id", "UNKNOWN_COMPANY", "Company not found.")
    if company.status != "active":
        raise _validation("company_id", "INACTIVE_COMPANY", "Company is not active.")
    return company


def _company_id_for_create(db: Session, actor: User, requested: uuid.UUID | None) -> uuid.UUID:
    if is_platform_admin(actor):
        company_id = actor.company_id if requested is None else requested
        if company_id is None:
            raise _validation("company_id", "REQUIRED", "Company is required.")
        _active_company(db, company_id)
        return company_id
    if actor.company_id is None:
        raise AppError(ErrorCode.FORBIDDEN, "You do not have permission to perform this action.", 403)
    if requested is not None and requested != actor.company_id:
        raise AppError(ErrorCode.FORBIDDEN, "You do not have permission to perform this action.", 403)
    _active_company(db, actor.company_id)
    return actor.company_id


def _owner_for_company(
    db: Session,
    actor: User,
    owner_id: uuid.UUID,
    company_id: uuid.UUID,
    *,
    reassigning: bool,
) -> User:
    if reassigning and ASSIGN_PERMISSION not in get_permission_keys(db, actor.id):
        raise AppError(ErrorCode.FORBIDDEN, "You cannot assign leads to other users.", 403)
    owner = db.get(User, owner_id)
    if owner is None or not owner.is_active or owner.company_id != company_id:
        raise _validation("owner_id", "UNKNOWN_OWNER", "Owner not found.")
    if reassigning:
        scope = resolve_record_scope(db, actor)
        if not record_is_in_scope(scope, owner_id=owner.id, company_id=company_id):
            raise _validation("owner_id", "UNKNOWN_OWNER", "Owner not found.")
    return owner


def _visible(db: Session, actor: User, lead_id: uuid.UUID) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None or lead.is_deleted:
        raise _not_found()
    scope = resolve_record_scope(db, actor)
    if not record_is_in_scope(scope, owner_id=lead.owner_id, company_id=lead.company_id):
        raise _not_found()
    return lead


def _next_lead_number(db: Session, project: Project | None = None) -> str:
    if project is None:
        number = db.execute(text("SELECT nextval('lead_number_seq')")).scalar_one()
        return f"LEAD-{int(number):06d}"
    count = int(
        db.scalar(
            select(func.count()).select_from(Lead).where(Lead.project_id == project.id, Lead.is_deleted.is_(False))
        )
        or 0
    )
    return f"{project.code}-{count + 1:04d}"


def _role_names(user: User) -> set[str]:
    return {link.role.name for link in user.user_roles}


def _project_for_lead(
    db: Session,
    actor: User,
    company_id: uuid.UUID,
    project_id: uuid.UUID | None,
    *,
    required: bool,
) -> Project | None:
    if project_id is None:
        if required:
            raise _validation("project_id", "REQUIRED", "Choose a project.")
        return None
    project = db.get(Project, project_id)
    if project is None or project.status != ACTIVE or project.company_id != company_id:
        raise _validation("project_id", "UNKNOWN_PROJECT", "Choose a project.")
    if RoleName.SUPER_ADMIN in _role_names(actor):
        return project
    if actor.company_id != company_id:
        raise _validation("project_id", "UNKNOWN_PROJECT", "Choose a project.")
    member_ids = project_ids_for_member(db, actor.id)
    if project.id not in member_ids:
        raise _validation("project_id", "NOT_ASSIGNED", "You are not assigned to this project.")
    return project


def project_names_for_leads(db: Session, leads: list[Lead]) -> dict[uuid.UUID, str]:
    ids = {lead.project_id for lead in leads if lead.project_id is not None}
    if not ids:
        return {}
    rows = db.execute(select(Project.id, Project.name).where(Project.id.in_(ids))).all()
    return {project_id: name for project_id, name in rows}


def _search_clause(term: str) -> Any:
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    return or_(
        Lead.full_name.ilike(pattern, escape="\\"),
        Lead.mobile.ilike(pattern, escape="\\"),
        Lead.alternate_mobile.ilike(pattern, escape="\\"),
        Lead.email.ilike(pattern, escape="\\"),
    )


def list_leads(
    db: Session,
    *,
    actor: User,
    filters: LeadFilters,
    limit: int,
    offset: int,
) -> tuple[list[Lead], int]:
    scope = resolve_record_scope(db, actor)
    if scope.owner_ids is not None and (
        not scope.owner_ids or (filters.owner_id is not None and filters.owner_id not in scope.owner_ids)
    ):
        return [], 0

    conditions: list[ColumnElement[bool]] = [Lead.is_deleted.is_(False)]
    if scope.company_id is not None:
        conditions.append(Lead.company_id == scope.company_id)
    if scope.owner_ids is not None:
        conditions.append(Lead.owner_id.in_(scope.owner_ids))
    if filters.owner_id is not None:
        conditions.append(Lead.owner_id == filters.owner_id)
    if filters.status is not None:
        key = normalize_status(filters.status)
        status_values = _STATUS_FILTER_VALUES.get(key, (key, filters.status))
        conditions.append(Lead.status.in_(status_values))
    if filters.priority is not None:
        priority_values = _PRIORITY_FILTER_VALUES.get(normalize_priority(filters.priority), (filters.priority,))
        conditions.append(Lead.priority.in_(priority_values))
    if filters.source is not None and filters.source.strip():
        conditions.append(Lead.lead_source == filters.source.strip())
    if filters.project_id is not None:
        conditions.append(Lead.project_id == filters.project_id)
    # Salespeople only work leads on projects they are assigned to (plus their own unscoped legacy rows).
    if RoleName.SALESPERSON in {link.role.name for link in actor.user_roles} and RoleName.BUSINESS_OWNER not in {
        link.role.name for link in actor.user_roles
    } and RoleName.SUPER_ADMIN not in {link.role.name for link in actor.user_roles}:
        member_ids = project_ids_for_member(db, actor.id)
        if member_ids:
            conditions.append(or_(Lead.project_id.in_(member_ids), Lead.project_id.is_(None)))
        else:
            return [], 0
    if filters.next_followup_on is not None:
        start = datetime(
            filters.next_followup_on.year,
            filters.next_followup_on.month,
            filters.next_followup_on.day,
            tzinfo=UTC,
        )
        conditions.append(Lead.next_followup_at >= start)
        conditions.append(Lead.next_followup_at < start + timedelta(days=1))
    if filters.search is not None and filters.search.strip():
        conditions.append(_search_clause(filters.search.strip()))

    total = int(db.scalar(select(func.count()).select_from(Lead).where(*conditions)) or 0)
    stmt = (
        select(Lead)
        .where(*conditions)
        .order_by(Lead.created_at.desc(), Lead.lead_number.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt).all()), total


def get_lead(db: Session, *, actor: User, lead_id: uuid.UUID) -> Lead:
    return _visible(db, actor, lead_id)


def create_lead(
    db: Session,
    *,
    actor: User,
    payload: CreateLeadRequest,
    ip_address: str | None,
) -> Lead:
    mobile = _clean_mobile(payload.mobile, "mobile")
    if mobile is None:
        raise _validation("mobile", "REQUIRED", "Mobile is required.")
    alternate = _clean_mobile(payload.alternate_mobile, "alternate_mobile")
    company_id = _company_id_for_create(db, actor, payload.company_id)
    owner_id = actor.id if payload.owner_id is None else payload.owner_id
    if payload.owner_id is None and actor.company_id != company_id:
        raise _validation("owner_id", "REQUIRED", "Owner is required.")
    _owner_for_company(db, actor, owner_id, company_id, reassigning=owner_id != actor.id)
    require_project = RoleName.SALESPERSON in _role_names(actor) and RoleName.SUPER_ADMIN not in _role_names(actor)
    project = _project_for_lead(db, actor, company_id, payload.project_id, required=require_project)
    extras = normalize_extra_values(
        db,
        None if project is None else project.id,
        payload.extra_values,
        require_required=True,
    )
    status_key = (
        entry_stage_key(db, company_id)
        if payload.status is None
        else assert_stage_key(db, company_id, payload.status)
    )
    now = datetime.now(UTC)
    lead = Lead(
        company_id=company_id,
        project_id=None if project is None else project.id,
        lead_number=_next_lead_number(db, project),
        full_name=payload.full_name,
        mobile=mobile,
        alternate_mobile=alternate,
        email=payload.email,
        company_name=payload.company_name,
        city=payload.city,
        address=payload.address,
        requirement=payload.requirement,
        expected_value=payload.expected_value,
        lead_source=payload.lead_source,
        owner_id=owner_id,
        created_by_id=actor.id,
        status=status_key,
        priority=payload.priority,
        next_followup_at=payload.next_followup_at,
        extra_values=extras or None,
        is_deleted=False,
        created_at=now,
        updated_at=now,
    )
    db.add(lead)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppError(ErrorCode.CONFLICT, "Lead could not be saved.", 409) from None
    record_audit(
        db,
        action="lead_created",
        actor_id=actor.id,
        target_type="lead",
        target_id=lead.id,
        context={
            "lead_number": lead.lead_number,
            "company_id": str(company_id),
            "owner_id": str(owner_id),
            "status": lead.status,
        },
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(lead)
    log_event(logger, "lead_created", actor_id=str(actor.id), lead_id=str(lead.id))
    return lead


def update_lead(
    db: Session,
    *,
    actor: User,
    lead_id: uuid.UUID,
    payload: UpdateLeadRequest,
    ip_address: str | None,
) -> Lead:
    fields = payload.model_fields_set
    if not fields:
        raise _validation("request", "REQUIRED", "Provide at least one field to update.")
    lead = _visible(db, actor, lead_id)
    changed: list[str] = []

    if "full_name" in fields:
        if payload.full_name is None:
            raise _validation("full_name", "REQUIRED", "Full name is required.")
        lead.full_name = payload.full_name
        changed.append("full_name")
    if "mobile" in fields:
        mobile = _clean_mobile(payload.mobile, "mobile")
        if mobile is None:
            raise _validation("mobile", "REQUIRED", "Mobile is required.")
        lead.mobile = mobile
        changed.append("mobile")
    if "alternate_mobile" in fields:
        lead.alternate_mobile = _clean_mobile(payload.alternate_mobile, "alternate_mobile")
        changed.append("alternate_mobile")
    if "email" in fields:
        lead.email = payload.email
        changed.append("email")
    if "company_name" in fields:
        lead.company_name = payload.company_name
        changed.append("company_name")
    if "city" in fields:
        lead.city = payload.city
        changed.append("city")
    if "address" in fields:
        lead.address = payload.address
        changed.append("address")
    if "requirement" in fields:
        lead.requirement = payload.requirement
        changed.append("requirement")
    if "expected_value" in fields:
        lead.expected_value = payload.expected_value
        changed.append("expected_value")
    if "lead_source" in fields:
        lead.lead_source = payload.lead_source
        changed.append("lead_source")
    if "status" in fields:
        if payload.status is None:
            raise _validation("status", "REQUIRED", "Status is required.")
        lead.status = assert_stage_key(db, lead.company_id, payload.status)
        changed.append("status")
    if "priority" in fields:
        if payload.priority is None:
            raise _validation("priority", "REQUIRED", "Priority is required.")
        lead.priority = payload.priority
        changed.append("priority")
    if "next_followup_at" in fields:
        if payload.next_followup_at is None:
            raise _validation("next_followup_at", "REQUIRED", "Next follow-up is required.")
        lead.next_followup_at = payload.next_followup_at
        changed.append("next_followup_at")
    if "project_id" in fields:
        project = _project_for_lead(
            db,
            actor,
            lead.company_id,
            payload.project_id,
            required=payload.project_id is not None
            or (RoleName.SALESPERSON in _role_names(actor) and RoleName.SUPER_ADMIN not in _role_names(actor)),
        )
        lead.project_id = None if project is None else project.id
        changed.append("project_id")
    if "extra_values" in fields:
        target_project_id = lead.project_id
        extras = normalize_extra_values(
            db,
            target_project_id,
            payload.extra_values,
            require_required=True,
        )
        lead.extra_values = extras or None
        changed.append("extra_values")
    if "owner_id" in fields:
        if payload.owner_id is None:
            raise _validation("owner_id", "REQUIRED", "Owner is required.")
        if payload.owner_id != lead.owner_id:
            _owner_for_company(
                db,
                actor,
                payload.owner_id,
                lead.company_id,
                reassigning=True,
            )
            lead.owner_id = payload.owner_id
            changed.append("owner_id")

    lead.updated_at = datetime.now(UTC)
    context: dict[str, Any] = {"fields": changed}
    if "owner_id" in changed:
        context["owner_id"] = str(lead.owner_id)
    record_audit(
        db,
        action="lead_updated",
        actor_id=actor.id,
        target_type="lead",
        target_id=lead.id,
        context=context,
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(lead)
    log_event(logger, "lead_updated", actor_id=str(actor.id), lead_id=str(lead.id))
    return lead


def delete_lead(
    db: Session,
    *,
    actor: User,
    lead_id: uuid.UUID,
    ip_address: str | None,
) -> Lead:
    lead = _visible(db, actor, lead_id)
    lead.is_deleted = True
    lead.updated_at = datetime.now(UTC)
    record_audit(
        db,
        action="lead_deleted",
        actor_id=actor.id,
        target_type="lead",
        target_id=lead.id,
        context={"lead_number": lead.lead_number, "is_deleted": True},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(lead)
    log_event(logger, "lead_deleted", actor_id=str(actor.id), lead_id=str(lead.id))
    return lead
