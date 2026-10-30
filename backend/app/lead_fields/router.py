"""HTTP routes for per-project lead fields."""

import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import client_ip, get_current_user
from app.common.responses import ApiResponse, error_responses
from app.core.database import get_db
from app.lead_fields.schemas import (
    CreateLeadFieldRequest,
    LeadFieldListData,
    LeadFieldPublic,
    ReorderLeadFieldsRequest,
    UpdateLeadFieldRequest,
    to_lead_field_public,
)
from app.lead_fields.service import (
    create_field,
    delete_field,
    list_fields,
    reorder_fields,
    update_field,
)
from app.users.models import User

router = APIRouter()


@router.get(
    "",
    response_model=ApiResponse[LeadFieldListData],
    summary="List lead fields for a project",
    description="Returns the extra fields defined for one project the caller can open.",
    responses=error_responses(401, 403, 422),
)
def get_lead_fields(
    project_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[LeadFieldListData]:
    return ApiResponse(data=list_fields(db, actor, project_id), message="Success")


@router.post(
    "",
    response_model=ApiResponse[LeadFieldPublic],
    summary="Add a lead field",
    description="Creates an extra field on a project. It appears on Create lead when Active is on.",
    responses=error_responses(401, 403, 409, 422),
)
def post_lead_field(
    payload: CreateLeadFieldRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[LeadFieldPublic]:
    created = create_field(db, actor, payload, client_ip(request))
    return ApiResponse(data=to_lead_field_public(created, 0), message=f"{created.label} is added.")


@router.patch(
    "/{field_id}",
    response_model=ApiResponse[LeadFieldPublic],
    summary="Update a lead field",
    description="Updates label, options, required, list, or active. Type is locked once leads hold data.",
    responses=error_responses(401, 403, 404, 422),
)
def patch_lead_field(
    field_id: uuid.UUID,
    payload: UpdateLeadFieldRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[LeadFieldPublic]:
    updated = update_field(db, actor, field_id, payload, client_ip(request))
    data = list_fields(db, actor, updated.project_id)
    item = next((row for row in data.items if row.id == str(updated.id)), to_lead_field_public(updated, 0))
    return ApiResponse(data=item, message="Field updated.")


@router.post(
    "/reorder",
    response_model=ApiResponse[LeadFieldListData],
    summary="Reorder lead fields",
    description="Sets the display order for every field on a project.",
    responses=error_responses(401, 403, 422),
)
def post_reorder(
    payload: ReorderLeadFieldsRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[LeadFieldListData]:
    data = reorder_fields(db, actor, payload, client_ip(request))
    return ApiResponse(data=data, message="Order saved.")


@router.delete(
    "/{field_id}",
    response_model=ApiResponse[LeadFieldListData],
    summary="Delete a lead field",
    description="Deletes a field only when no lead holds data for it. Otherwise deactivate it.",
    responses=error_responses(401, 403, 404, 409),
)
def remove_lead_field(
    field_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[LeadFieldListData]:
    project_id = delete_field(db, actor, field_id, client_ip(request))
    return ApiResponse(data=list_fields(db, actor, project_id), message="Field deleted.")
