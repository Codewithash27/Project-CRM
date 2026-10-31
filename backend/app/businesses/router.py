"""Business routes for Super Admin."""

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import client_ip, get_current_user
from app.businesses.schemas import (
    BusinessListData,
    BusinessPublic,
    CreateBusinessRequest,
    UpdateBusinessRequest,
)
from app.businesses.service import (
    create_business,
    delete_business,
    list_businesses,
    update_business,
)
from app.common.responses import ApiResponse, MessageData, error_responses
from app.core.database import get_db
from app.users.models import User

router = APIRouter()


@router.get(
    "",
    response_model=ApiResponse[BusinessListData],
    summary="List businesses",
    description="Super Admin lists every business with usage counts.",
    responses=error_responses(401, 403),
)
def get_businesses(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[BusinessListData]:
    items = list_businesses(db, actor)
    return ApiResponse(data=BusinessListData(can_manage=True, items=items), message="Success")


@router.post(
    "",
    response_model=ApiResponse[BusinessPublic],
    summary="Create a business",
    description="Super Admin creates a business. Owners and projects are added later.",
    responses=error_responses(401, 403, 422),
)
def post_business(
    payload: CreateBusinessRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[BusinessPublic]:
    created = create_business(db, actor, payload, client_ip(request))
    return ApiResponse(data=created, message=f"{created.name} is created.")


@router.patch(
    "/{company_id}",
    response_model=ApiResponse[BusinessPublic],
    summary="Update a business",
    description="Super Admin renames a business, changes its plan label, or activates/suspends it.",
    responses=error_responses(401, 403, 404, 422),
)
def patch_business(
    company_id: uuid.UUID,
    payload: UpdateBusinessRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[BusinessPublic]:
    updated = update_business(db, actor, company_id, payload, client_ip(request))
    return ApiResponse(data=updated, message=f"{updated.name} is updated.")


@router.delete(
    "/{company_id}",
    response_model=ApiResponse[MessageData],
    summary="Delete a business",
    description=(
        "Super Admin deletes an empty business. If users, projects, teams, or leads exist, "
        "delete is refused — set the business inactive instead."
    ),
    responses=error_responses(401, 403, 404, 409),
)
def remove_business(
    company_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[MessageData]:
    delete_business(db, actor, company_id, client_ip(request))
    return ApiResponse(data=MessageData(), message="Business deleted.")
