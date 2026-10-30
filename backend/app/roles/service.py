"""Role queries and Super Admin role design."""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.audit.service import record_audit
from app.common.exceptions import AppError, ErrorCode
from app.core.logging import log_event
from app.permissions.models import Permission, RolePermission
from app.roles.models import Role, UserRole
from app.roles.schemas import SYSTEM_ROLES, CreateRoleRequest

logger = logging.getLogger("app.roles")


class RoleName:
    SUPER_ADMIN = "SUPER_ADMIN"
    BUSINESS_OWNER = "BUSINESS_OWNER"
    MARKETING = "MARKETING"
    SALESPERSON = "SALESPERSON"


def get_role_by_name(db: Session, name: str) -> Role | None:
    stmt = (
        select(Role)
        .where(Role.name == name)
        .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
    )
    return db.scalar(stmt)


def get_role_by_id(db: Session, role_id: uuid.UUID) -> Role | None:
    stmt = (
        select(Role)
        .where(Role.id == role_id)
        .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
    )
    return db.scalar(stmt)


def list_roles(db: Session) -> list[Role]:
    stmt = select(Role).options(
        selectinload(Role.role_permissions).selectinload(RolePermission.permission)
    ).order_by(Role.name)
    return list(db.scalars(stmt).all())


def _validation(field: str, code: str, message: str) -> AppError:
    return AppError(
        ErrorCode.VALIDATION_ERROR,
        message,
        422,
        details=[{"field": field, "code": code, "message": message}],
    )


def _permissions_by_keys(db: Session, keys: list[str]) -> list[Permission]:
    rows = list(db.scalars(select(Permission).where(Permission.key.in_(keys))).all())
    found = {permission.key: permission for permission in rows}
    missing = [key for key in keys if key not in found]
    if missing:
        raise _validation(
            "permissions",
            "UNKNOWN_PERMISSION",
            f"Unknown permission: {missing[0]}",
        )
    return [found[key] for key in keys]


def _replace_permissions(db: Session, role: Role, keys: list[str]) -> None:
    permissions = _permissions_by_keys(db, keys)
    role.role_permissions.clear()
    db.flush()
    for permission in permissions:
        role.role_permissions.append(RolePermission(permission_id=permission.id))


def create_role(
    db: Session,
    *,
    actor_id: uuid.UUID,
    payload: CreateRoleRequest,
    ip_address: str | None,
) -> Role:
    if get_role_by_name(db, payload.name) is not None:
        raise AppError(ErrorCode.CONFLICT, "A role with this name already exists.", 409)
    role = Role(name=payload.name, description=payload.description or payload.name)
    db.add(role)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppError(ErrorCode.CONFLICT, "A role with this name already exists.", 409) from None
    _replace_permissions(db, role, payload.permissions)
    record_audit(
        db,
        action="role_created",
        actor_id=actor_id,
        target_type="role",
        target_id=role.id,
        context={"name": role.name, "permissions": payload.permissions},
        ip_address=ip_address,
    )
    db.commit()
    created = get_role_by_id(db, role.id)
    assert created is not None
    log_event(logger, "role_created", actor_id=str(actor_id), role=role.name)
    return created


def update_role_permissions(
    db: Session,
    *,
    actor_id: uuid.UUID,
    role_id: uuid.UUID,
    permission_keys: list[str],
    ip_address: str | None,
) -> Role:
    role = get_role_by_id(db, role_id)
    if role is None:
        raise AppError(ErrorCode.NOT_FOUND, "Role not found.", 404)
    if role.name == RoleName.SUPER_ADMIN and "roles.update" not in permission_keys:
        raise _validation(
            "permissions",
            "REQUIRED",
            "Super Admin must keep roles.update so the permission map can still be edited.",
        )
    _replace_permissions(db, role, permission_keys)
    record_audit(
        db,
        action="role_permissions_updated",
        actor_id=actor_id,
        target_type="role",
        target_id=role.id,
        context={"name": role.name, "permissions": permission_keys},
        ip_address=ip_address,
    )
    db.commit()
    updated = get_role_by_id(db, role.id)
    assert updated is not None
    log_event(logger, "role_permissions_updated", actor_id=str(actor_id), role=role.name)
    return updated


def delete_role(
    db: Session,
    *,
    actor_id: uuid.UUID,
    role_id: uuid.UUID,
    ip_address: str | None,
):
    role = get_role_by_id(db, role_id)
    if role is None:
        raise AppError(ErrorCode.NOT_FOUND, "Role not found.", 404)
    if role.name in SYSTEM_ROLES:
        raise AppError(ErrorCode.FORBIDDEN, "System roles cannot be deleted.", 403)
    in_use = db.scalar(select(UserRole.user_id).where(UserRole.role_id == role.id).limit(1)) is not None
    if in_use:
        raise AppError(
            ErrorCode.CONFLICT,
            "This role is assigned to one or more users. Change those users first.",
            409,
        )
    from app.roles.schemas import to_role_public

    public = to_role_public(role)
    record_audit(
        db,
        action="role_deleted",
        actor_id=actor_id,
        target_type="role",
        target_id=role.id,
        context={"name": role.name},
        ip_address=ip_address,
    )
    db.delete(role)
    db.commit()
    log_event(logger, "role_deleted", actor_id=str(actor_id), role=public.name)
    return public
