"""Create, update, and delete businesses (companies). Super Admin only."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import record_audit
from app.businesses.schemas import CreateBusinessRequest, UpdateBusinessRequest, BusinessPublic
from app.common.exceptions import AppError, ErrorCode
from app.leads.models import Lead
from app.organization.models import Company, Project, Team
from app.roles.service import RoleName
from app.users.models import User


def _role_names(user: User) -> set[str]:
    return {link.role.name for link in user.user_roles}


def _forbidden() -> AppError:
    return AppError(ErrorCode.FORBIDDEN, "You do not have permission to perform this action.", 403)


def _validation(field: str, code: str, message: str) -> AppError:
    return AppError(
        ErrorCode.VALIDATION_ERROR,
        message,
        422,
        details=[{"field": field, "code": code, "message": message}],
    )


def require_super_admin(actor: User) -> None:
    if RoleName.SUPER_ADMIN not in _role_names(actor):
        raise _forbidden()


def _counts(db: Session, company_id: uuid.UUID) -> tuple[int, int, int, int]:
    users = db.scalar(select(func.count()).select_from(User).where(User.company_id == company_id)) or 0
    projects = db.scalar(select(func.count()).select_from(Project).where(Project.company_id == company_id)) or 0
    teams = db.scalar(select(func.count()).select_from(Team).where(Team.company_id == company_id)) or 0
    leads = db.scalar(select(func.count()).select_from(Lead).where(Lead.company_id == company_id)) or 0
    return int(users), int(projects), int(teams), int(leads)


def _profile_snapshot(company: Company) -> dict[str, str | None]:
    return {
        "name": company.name,
        "status": company.status,
        "plan_label": company.plan_label,
        "industry": company.industry,
        "website": company.website,
        "email": company.email,
        "phone": company.phone,
        "city": company.city,
        "address": company.address,
        "gst_number": company.gst_number,
        "remarks": company.remarks,
    }


def _apply_profile(company: Company, payload: CreateBusinessRequest | UpdateBusinessRequest) -> None:
    company.name = payload.name
    company.status = payload.status
    company.plan_label = payload.plan_label
    company.industry = payload.industry
    company.website = payload.website
    company.email = payload.email
    company.phone = payload.phone
    company.city = payload.city
    company.address = payload.address
    company.gst_number = payload.gst_number
    company.remarks = payload.remarks


def _to_public(db: Session, company: Company) -> BusinessPublic:
    user_count, project_count, team_count, lead_count = _counts(db, company.id)
    return BusinessPublic(
        id=str(company.id),
        name=company.name,
        status=company.status,
        plan_label=company.plan_label,
        industry=company.industry,
        website=company.website,
        email=company.email,
        phone=company.phone,
        city=company.city,
        address=company.address,
        gst_number=company.gst_number,
        remarks=company.remarks,
        user_count=user_count,
        project_count=project_count,
        team_count=team_count,
        lead_count=lead_count,
        can_delete=user_count + project_count + team_count + lead_count == 0,
    )


def _assert_unique_name(db: Session, name: str, *, exclude_id: uuid.UUID | None = None) -> None:
    stmt = select(Company.id).where(func.lower(Company.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Company.id != exclude_id)
    if db.scalar(stmt.limit(1)) is not None:
        raise _validation("name", "DUPLICATE_NAME", "A business with this name already exists.")


def list_businesses(db: Session, actor: User) -> list[BusinessPublic]:
    require_super_admin(actor)
    companies = list(db.scalars(select(Company).order_by(Company.name)).all())
    return [_to_public(db, company) for company in companies]


def create_business(
    db: Session,
    actor: User,
    payload: CreateBusinessRequest,
    ip_address: str | None,
) -> BusinessPublic:
    require_super_admin(actor)
    _assert_unique_name(db, payload.name)
    now = datetime.now(UTC)
    company = Company(created_at=now, updated_at=now)
    _apply_profile(company, payload)
    db.add(company)
    db.flush()
    record_audit(
        db,
        action="business_created",
        actor_id=actor.id,
        target_type="company",
        target_id=company.id,
        context=_profile_snapshot(company),
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(company)
    return _to_public(db, company)


def update_business(
    db: Session,
    actor: User,
    company_id: uuid.UUID,
    payload: UpdateBusinessRequest,
    ip_address: str | None,
) -> BusinessPublic:
    require_super_admin(actor)
    company = db.get(Company, company_id)
    if company is None:
        raise AppError(ErrorCode.NOT_FOUND, "Business not found.", 404)
    _assert_unique_name(db, payload.name, exclude_id=company.id)
    previous = _profile_snapshot(company)
    _apply_profile(company, payload)
    company.updated_at = datetime.now(UTC)
    record_audit(
        db,
        action="business_updated",
        actor_id=actor.id,
        target_type="company",
        target_id=company.id,
        context={"before": previous, "after": _profile_snapshot(company)},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(company)
    return _to_public(db, company)


def delete_business(
    db: Session,
    actor: User,
    company_id: uuid.UUID,
    ip_address: str | None,
) -> None:
    require_super_admin(actor)
    company = db.get(Company, company_id)
    if company is None:
        raise AppError(ErrorCode.NOT_FOUND, "Business not found.", 404)
    user_count, project_count, team_count, lead_count = _counts(db, company.id)
    if user_count + project_count + team_count + lead_count > 0:
        raise AppError(
            ErrorCode.CONFLICT,
            "This business still has users, projects, teams, or leads. Remove those first, or set the business inactive.",
            409,
        )
    name = company.name
    record_audit(
        db,
        action="business_deleted",
        actor_id=actor.id,
        target_type="company",
        target_id=company.id,
        context={"name": name},
        ip_address=ip_address,
    )
    db.delete(company)
    db.commit()

