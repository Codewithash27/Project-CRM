"""Admin access-management routes."""

import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import client_ip, require_admin_permission, require_permission
from app.common.responses import ApiResponse, error_responses
from app.core.database import get_db
from app.users.models import User
from app.users.schemas import (
    AccessUser,
    AssignRoleRequest,
    CreateUserRequest,
    UpdateManagedUserRequest,
    UpdateStatusRequest,
    UserListData,
    to_access_user,
)
from app.users.service import (
    change_user_role,
    create_managed_user,
    deactivate_managed_user,
    is_platform_admin,
    list_users,
    set_user_active,
    update_managed_user,
)

router = APIRouter()


@router.get(
    "",
    response_model=ApiResponse[UserListData],
    summary="List users",
    description=(
        "Returns accounts with their current roles and active status. Requires users.read. "
        "A platform administrator sees every account. A company administrator sees accounts "
        "in their own company."
    ),
    responses=error_responses(401, 403),
)
def get_users(
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("users.read")),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ApiResponse[UserListData]:
    users, total = list_users(
        db,
        limit=limit,
        offset=offset,
        company_id=actor.company_id,
        company_scoped=not is_platform_admin(actor),
    )
    return ApiResponse(
        data=UserListData(items=[to_access_user(user) for user in users], total=total),
        message="Success",
    )


@router.patch(
    "/{user_id}/role",
    response_model=ApiResponse[AccessUser],
    summary="Assign a role",
    description=(
        "Replaces another user's roles. Requires an authenticated administrator with roles.assign. "
        "A user cannot change their own role, and the last active administrator cannot be demoted."
    ),
    responses=error_responses(401, 403, 404, 409, 422),
)
def assign_role(
    user_id: uuid.UUID,
    payload: AssignRoleRequest,
    request: Request,
    actor: User = Depends(require_admin_permission("roles.assign")),
    db: Session = Depends(get_db),
) -> ApiResponse[AccessUser]:
    updated = change_user_role(
        db,
        actor=actor,
        target_id=user_id,
        role_name=payload.role,
        ip_address=client_ip(request),
    )
    return ApiResponse(data=to_access_user(updated), message="Role updated.")


@router.patch(
    "/{user_id}/status",
    response_model=ApiResponse[AccessUser],
    summary="Activate or deactivate a user",
    description=(
        "Requires an authenticated administrator with users.update. "
        "Deactivation revokes that user's sessions. Users cannot change their own status."
    ),
    responses=error_responses(401, 403, 404, 409, 422),
)
def update_status(
    user_id: uuid.UUID,
    payload: UpdateStatusRequest,
    request: Request,
    actor: User = Depends(require_admin_permission("users.update")),
    db: Session = Depends(get_db),
) -> ApiResponse[AccessUser]:
    updated = set_user_active(
        db,
        actor=actor,
        target_id=user_id,
        is_active=payload.is_active,
        ip_address=client_ip(request),
    )
    return ApiResponse(data=to_access_user(updated), message="User updated.")


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[AccessUser],
    summary="Create a user",
    description=(
        "Creates an account with a hashed password and one role. Requires users.create. "
        "A company administrator can create users only in their own company. "
        "The password hash is never returned."
    ),
    responses=error_responses(401, 403, 409, 422),
)
def create_user(
    payload: CreateUserRequest,
    request: Request,
    actor: User = Depends(require_permission("users.create")),
    db: Session = Depends(get_db),
) -> ApiResponse[AccessUser]:
    created = create_managed_user(db, actor=actor, payload=payload, ip_address=client_ip(request))
    return ApiResponse(data=to_access_user(created), message="User created.")


@router.patch(
    "/{user_id}",
    response_model=ApiResponse[AccessUser],
    summary="Update a user",
    description=(
        "Updates role, team, manager, or active status. Requires users.update. "
        "Changing the role also requires roles.assign. "
        "A company administrator can update users only in their own company."
    ),
    responses=error_responses(401, 403, 404, 409, 422),
)
def update_user(
    user_id: uuid.UUID,
    payload: UpdateManagedUserRequest,
    request: Request,
    actor: User = Depends(require_permission("users.update")),
    db: Session = Depends(get_db),
) -> ApiResponse[AccessUser]:
    updated = update_managed_user(
        db,
        actor=actor,
        target_id=user_id,
        payload=payload,
        ip_address=client_ip(request),
    )
    return ApiResponse(data=to_access_user(updated), message="User updated.")


@router.delete(
    "/{user_id}",
    response_model=ApiResponse[AccessUser],
    summary="Deactivate a user",
    description=(
        "Soft-deletes an account by marking it inactive and revoking its sessions. "
        "Requires users.delete. The account row is kept."
    ),
    responses=error_responses(401, 403, 404, 409),
)
def delete_user(
    user_id: uuid.UUID,
    request: Request,
    actor: User = Depends(require_permission("users.delete")),
    db: Session = Depends(get_db),
) -> ApiResponse[AccessUser]:
    updated = deactivate_managed_user(
        db,
        actor=actor,
        target_id=user_id,
        ip_address=client_ip(request),
    )
    return ApiResponse(data=to_access_user(updated), message="User deactivated.")
