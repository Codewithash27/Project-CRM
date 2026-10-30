"""Team board: assign projects to owners / salespeople, add reps, move leads."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.audit.service import record_audit
from app.common.exceptions import AppError, ErrorCode
from app.core.logging import log_event
from app.core.security import hash_password
from app.leads.models import Lead
from app.organization.models import ACTIVE, Company, Project, ProjectMember
from app.roles.models import Role, UserRole
from app.roles.service import RoleName, get_role_by_name
from app.team.schemas import (
    CreateSalespersonRequest,
    MoveLeadsRequest,
    MoveLeadsResult,
    SetAssignmentRequest,
    TeamAssignment,
    TeamBoardData,
    TeamCompany,
    TeamLeadCount,
    TeamPerson,
    TeamProject,
)
from app.users.models import User
from app.users.service import _password_error

import logging

logger = logging.getLogger("app.team")


def _forbidden() -> AppError:
    return AppError(ErrorCode.FORBIDDEN, "You do not have permission to perform this action.", 403)


def _validation(field: str, code: str, message: str) -> AppError:
    return AppError(
        ErrorCode.VALIDATION_ERROR,
        message,
        422,
        details=[{"field": field, "code": code, "message": message}],
    )


def _role_names(user: User) -> set[str]:
    return {link.role.name for link in user.user_roles}


def _primary_role(user: User) -> str:
    names = _role_names(user)
    for name in (RoleName.SUPER_ADMIN, RoleName.BUSINESS_OWNER, RoleName.SALESPERSON, RoleName.MARKETING):
        if name in names:
            return name
    return next(iter(names), "UNKNOWN")


def _is_platform(user: User) -> bool:
    return RoleName.SUPER_ADMIN in _role_names(user)


def _is_owner(user: User) -> bool:
    return RoleName.BUSINESS_OWNER in _role_names(user)


def _person(user: User, company_name: str | None = None) -> TeamPerson:
    return TeamPerson(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        role=_primary_role(user),
        company_id=None if user.company_id is None else str(user.company_id),
        company_name=company_name,
    )


def _users_with_role(db: Session, role_name: str, company_id: uuid.UUID | None = None) -> list[User]:
    stmt = (
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(User.is_active.is_(True), Role.name == role_name)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .order_by(User.full_name)
    )
    if company_id is not None:
        stmt = stmt.where(User.company_id == company_id)
    return list(db.scalars(stmt).unique().all())


def _company_names(db: Session, company_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not company_ids:
        return {}
    rows = db.execute(select(Company.id, Company.name).where(Company.id.in_(company_ids))).all()
    return {company_id: name for company_id, name in rows}


def _assign_owners_to_project(
    db: Session,
    *,
    project: Project,
    actor_id: uuid.UUID,
    owner_ids: list[uuid.UUID] | None = None,
) -> None:
    owners = _users_with_role(db, RoleName.BUSINESS_OWNER, project.company_id)
    if owner_ids is not None:
        wanted = set(owner_ids)
        owners = [owner for owner in owners if owner.id in wanted]
    now = datetime.now(UTC)
    for owner in owners:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=owner.id,
                assigned_by_id=actor_id,
                created_at=now,
            )
        )


def ensure_project_owners(db: Session, project: Project, actor_id: uuid.UUID) -> None:
    """Call after creating a project so business owners of that company can see it."""
    _assign_owners_to_project(db, project=project, actor_id=actor_id)


def project_ids_for_member(db: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    return set(db.scalars(select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)).all())


def get_team_board(db: Session, actor: User, company_id: uuid.UUID | None = None) -> TeamBoardData:
    if _is_platform(actor):
        return _platform_board(db, actor, company_id)
    if _is_owner(actor):
        return _owner_board(db, actor)
    raise _forbidden()


def _platform_board(db: Session, actor: User, company_id: uuid.UUID | None) -> TeamBoardData:
    companies = list(db.scalars(select(Company).where(Company.status == ACTIVE).order_by(Company.name)).all())
    if company_id is not None and not any(company.id == company_id for company in companies):
        raise _validation("company_id", "UNKNOWN_COMPANY", "Choose a business.")
    project_stmt = (
        select(Project, Company.name)
        .join(Company, Company.id == Project.company_id)
        .where(Project.status == ACTIVE)
        .order_by(Company.name, Project.name)
    )
    if company_id is not None:
        project_stmt = project_stmt.where(Project.company_id == company_id)
    project_rows = db.execute(project_stmt).all()
    owners = _users_with_role(db, RoleName.BUSINESS_OWNER, company_id)
    owners = [owner for owner in owners if owner.company_id is not None]
    company_names = _company_names(db, {owner.company_id for owner in owners if owner.company_id})
    project_ids = [project.id for project, _ in project_rows]
    owner_ids = [owner.id for owner in owners]
    assignments: list[TeamAssignment] = []
    if project_ids and owner_ids:
        links = db.execute(
            select(ProjectMember.project_id, ProjectMember.user_id).where(
                ProjectMember.project_id.in_(project_ids),
                ProjectMember.user_id.in_(owner_ids),
            )
        ).all()
        assignments = [TeamAssignment(project_id=str(pid), user_id=str(uid)) for pid, uid in links]
    return TeamBoardData(
        mode="platform",
        companies=[TeamCompany(id=str(c.id), name=c.name) for c in companies],
        projects=[
            TeamProject(
                id=str(project.id),
                name=project.name,
                code=project.code,
                company_id=str(project.company_id),
                company_name=company_name,
            )
            for project, company_name in project_rows
        ],
        people=[_person(owner, company_names.get(owner.company_id) if owner.company_id else None) for owner in owners],
        assignments=assignments,
        lead_counts=[],
        viewer=_person(actor),
    )


def _owner_board(db: Session, actor: User) -> TeamBoardData:
    if actor.company_id is None:
        raise _forbidden()
    company = db.get(Company, actor.company_id)
    if company is None:
        raise _forbidden()
    member_ids = project_ids_for_member(db, actor.id)
    if not member_ids:
        projects = []
    else:
        projects = list(
            db.scalars(
                select(Project)
                .where(
                    Project.company_id == actor.company_id,
                    Project.status == ACTIVE,
                    Project.id.in_(member_ids),
                )
                .order_by(Project.name)
            ).all()
        )
    salespeople = _users_with_role(db, RoleName.SALESPERSON, actor.company_id)
    marketers = _users_with_role(db, RoleName.MARKETING, actor.company_id)
    project_ids = [project.id for project in projects]
    people_ids = [person.id for person in salespeople]
    assignments: list[TeamAssignment] = []
    if project_ids and people_ids:
        links = db.execute(
            select(ProjectMember.project_id, ProjectMember.user_id).where(
                ProjectMember.project_id.in_(project_ids),
                ProjectMember.user_id.in_(people_ids),
            )
        ).all()
        assignments = [TeamAssignment(project_id=str(pid), user_id=str(uid)) for pid, uid in links]
    lead_counts: list[TeamLeadCount] = []
    if project_ids:
        count_user_ids = people_ids + [actor.id]
        rows = db.execute(
            select(Lead.project_id, Lead.owner_id, func.count())
            .where(
                Lead.project_id.in_(project_ids),
                Lead.owner_id.in_(count_user_ids),
                Lead.is_deleted.is_(False),
            )
            .group_by(Lead.project_id, Lead.owner_id)
        ).all()
        lead_counts = [
            TeamLeadCount(project_id=str(project_id), user_id=str(owner_id), count=int(total))
            for project_id, owner_id, total in rows
        ]
    people = [_person(user, company.name) for user in salespeople + marketers]
    return TeamBoardData(
        mode="owner",
        companies=[TeamCompany(id=str(company.id), name=company.name)],
        projects=[
            TeamProject(
                id=str(project.id),
                name=project.name,
                code=project.code,
                company_id=str(project.company_id),
                company_name=company.name,
            )
            for project in projects
        ],
        people=people,
        assignments=assignments,
        lead_counts=lead_counts,
        viewer=_person(actor, company.name),
    )


def set_assignment(
    db: Session,
    actor: User,
    payload: SetAssignmentRequest,
    ip_address: str | None,
) -> TeamBoardData:
    project = db.get(Project, payload.project_id)
    if project is None or project.status != ACTIVE:
        raise _validation("project_id", "UNKNOWN_PROJECT", "Choose a project.")
    target = db.get(User, payload.user_id)
    if target is None or not target.is_active:
        raise _validation("user_id", "UNKNOWN_USER", "Choose a person.")
    target = (
        db.scalars(
            select(User)
            .where(User.id == payload.user_id)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
        ).first()
    )
    assert target is not None
    roles = _role_names(target)

    if _is_platform(actor):
        if RoleName.BUSINESS_OWNER not in roles:
            raise _validation("user_id", "NOT_OWNER", "Choose a business owner.")
        if target.company_id != project.company_id:
            raise _validation("user_id", "COMPANY_MISMATCH", "That owner belongs to a different business.")
    elif _is_owner(actor):
        if actor.company_id is None or actor.company_id != project.company_id:
            raise _forbidden()
        if RoleName.SALESPERSON not in roles:
            raise _validation("user_id", "NOT_SALESPERSON", "Choose a salesperson.")
        if target.company_id != actor.company_id:
            raise _validation("user_id", "COMPANY_MISMATCH", "That person belongs to a different business.")
        # Owner should be assigned to the project (or have no memberships yet).
        owner_projects = project_ids_for_member(db, actor.id)
        if owner_projects and project.id not in owner_projects:
            raise _forbidden()
    else:
        raise _forbidden()

    existing = db.get(ProjectMember, (project.id, target.id))
    if payload.assigned and existing is None:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=target.id,
                assigned_by_id=actor.id,
                created_at=datetime.now(UTC),
            )
        )
        action = "project_member_assigned"
    elif not payload.assigned and existing is not None:
        db.delete(existing)
        action = "project_member_removed"
    else:
        action = "project_member_unchanged"
    if action != "project_member_unchanged":
        record_audit(
            db,
            action=action,
            actor_id=actor.id,
            target_type="project",
            target_id=project.id,
            context={"user_id": str(target.id), "assigned": payload.assigned},
            ip_address=ip_address,
        )
        db.commit()
        log_event(logger, action, actor_id=str(actor.id), project_id=str(project.id), user_id=str(target.id))
    company_filter = project.company_id if _is_platform(actor) else None
    return get_team_board(db, actor, company_filter)


def create_salesperson(
    db: Session,
    actor: User,
    payload: CreateSalespersonRequest,
    ip_address: str | None,
) -> TeamBoardData:
    if not _is_owner(actor) or actor.company_id is None:
        raise _forbidden()
    _password_error(payload.password)
    role = get_role_by_name(db, RoleName.SALESPERSON)
    if role is None:
        raise AppError(ErrorCode.INTERNAL_ERROR, "Salesperson role is missing.", 500)
    if db.scalar(select(User).where(User.email == payload.email)) is not None:
        raise AppError(ErrorCode.EMAIL_ALREADY_EXISTS, "An account with this email already exists.", 409)
    now = datetime.now(UTC)
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        preferred_language="en",
        is_active=True,
        email_verified=False,
        session_version=1,
        company_id=actor.company_id,
        created_at=now,
        updated_at=now,
    )
    user.user_roles.append(UserRole(role=role, created_at=now))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppError(ErrorCode.EMAIL_ALREADY_EXISTS, "An account with this email already exists.", 409) from None
    record_audit(
        db,
        action="salesperson_created",
        actor_id=actor.id,
        target_type="user",
        target_id=user.id,
        context={"company_id": str(actor.company_id)},
        ip_address=ip_address,
    )
    db.commit()
    log_event(logger, "salesperson_created", actor_id=str(actor.id), target_id=str(user.id))
    return get_team_board(db, actor)


def move_leads(
    db: Session,
    actor: User,
    payload: MoveLeadsRequest,
    ip_address: str | None,
) -> MoveLeadsResult:
    if not _is_owner(actor) or actor.company_id is None:
        raise _forbidden()
    if payload.from_user_id == payload.to_user_id:
        raise _validation("to_user_id", "SAME_PERSON", "Choose a different salesperson.")
    project = db.get(Project, payload.project_id)
    if project is None or project.company_id != actor.company_id or project.status != ACTIVE:
        raise _validation("project_id", "UNKNOWN_PROJECT", "Choose a project.")
    owner_projects = project_ids_for_member(db, actor.id)
    if owner_projects and project.id not in owner_projects:
        raise _forbidden()

    def _require_salesperson(user_id: uuid.UUID, field: str) -> User:
        user = db.scalars(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
        ).first()
        if user is None or not user.is_active or user.company_id != actor.company_id:
            raise _validation(field, "UNKNOWN_USER", "Choose a salesperson.")
        if RoleName.SALESPERSON not in _role_names(user):
            raise _validation(field, "NOT_SALESPERSON", "Choose a salesperson.")
        return user

    _require_salesperson(payload.from_user_id, "from_user_id")
    _require_salesperson(payload.to_user_id, "to_user_id")

    leads = list(
        db.scalars(
            select(Lead).where(
                Lead.project_id == project.id,
                Lead.owner_id == payload.from_user_id,
                Lead.company_id == actor.company_id,
                Lead.is_deleted.is_(False),
            )
        ).all()
    )
    now = datetime.now(UTC)
    for lead in leads:
        lead.owner_id = payload.to_user_id
        lead.updated_at = now
    record_audit(
        db,
        action="leads_moved",
        actor_id=actor.id,
        target_type="project",
        target_id=project.id,
        context={
            "from_user_id": str(payload.from_user_id),
            "to_user_id": str(payload.to_user_id),
            "moved": len(leads),
        },
        ip_address=ip_address,
    )
    db.commit()
    log_event(logger, "leads_moved", actor_id=str(actor.id), moved=len(leads), project_id=str(project.id))
    return MoveLeadsResult(moved=len(leads))
