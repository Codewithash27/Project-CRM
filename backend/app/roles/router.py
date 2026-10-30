"""Role catalogue and Super Admin role design routes."""

import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import client_ip, require_permission
from app.common.responses import ApiResponse, error_responses
from app.core.database import get_db
from app.roles.schemas import (
    CreateRoleRequest,
    RolePublic,
    UpdateRolePermissionsRequest,
    to_role_public,
)
from app.roles.service import create_role, delete_role, list_roles, update_role_permissions
from app.users.models import User

router = APIRouter()


@router.get(
    "",
    response_model=ApiResponse[list[RolePublic]],
    summary="List roles and their permissions",
    description="Returns every role and the permissions explicitly granted to it. Requires roles.read.",
    responses=error_responses(401, 403),
    dependencies=[Depends(require_permission("roles.read"))],
)
def get_roles(db: Session = Depends(get_db)) -> ApiResponse[list[RolePublic]]:
    return ApiResponse(data=[to_role_public(role) for role in list_roles(db)], message="Success")


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[RolePublic],
    summary="Create a role",
    description="Creates a custom role and sets its permissions. Requires roles.create.",
    responses=error_responses(401, 403, 409, 422),
)
def post_role(
    payload: CreateRoleRequest,
    request: Request,
    actor: User = Depends(require_permission("roles.create")),
    db: Session = Depends(get_db),
) -> ApiResponse[RolePublic]:
    created = create_role(
        db,
        actor_id=actor.id,
        payload=payload,
        ip_address=client_ip(request),
    )
    return ApiResponse(data=to_role_public(created), message="Role created.")


@router.patch(
    "/{role_id}/permissions",
    response_model=ApiResponse[RolePublic],
    summary="Update role permissions",
    description="Replaces the permission set for a role. Requires roles.update.",
    responses=error_responses(401, 403, 404, 422),
)
def patch_role_permissions(
    role_id: uuid.UUID,
    payload: UpdateRolePermissionsRequest,
    request: Request,
    actor: User = Depends(require_permission("roles.update")),
    db: Session = Depends(get_db),
) -> ApiResponse[RolePublic]:
    updated = update_role_permissions(
        db,
        actor_id=actor.id,
        role_id=role_id,
        permission_keys=payload.permissions,
        ip_address=client_ip(request),
    )
    return ApiResponse(data=to_role_public(updated), message="Role permissions updated.")


@router.delete(
    "/{role_id}",
    response_model=ApiResponse[RolePublic],
    summary="Delete a custom role",
    description="Deletes a custom role that is not assigned to any user. Requires roles.update.",
    responses=error_responses(401, 403, 404, 409),
)
def remove_role(
    role_id: uuid.UUID,
    request: Request,
    actor: User = Depends(require_permission("roles.update")),
    db: Session = Depends(get_db),
) -> ApiResponse[RolePublic]:
    deleted = delete_role(
        db,
        actor_id=actor.id,
        role_id=role_id,
        ip_address=client_ip(request),
    )
    return ApiResponse(data=deleted, message="Role deleted.")
