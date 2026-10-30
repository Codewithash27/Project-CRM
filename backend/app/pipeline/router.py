"""HTTP routes for project pipeline stages."""

import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import client_ip, require_permission
from app.common.responses import ApiResponse, error_responses
from app.core.database import get_db
from app.pipeline.schemas import (
    CreatePipelineStageRequest,
    DeletePipelineStageRequest,
    PipelineStageListData,
    PipelineStagePublic,
    ReorderPipelineStagesRequest,
    UpdatePipelineStageRequest,
    to_stage_public,
)
from app.pipeline.service import (
    create_stage,
    delete_stage,
    list_stages,
    reorder_stages,
    update_stage,
)
from app.users.models import User

router = APIRouter()


@router.get(
    "",
    response_model=ApiResponse[PipelineStageListData],
    summary="List pipeline stages",
    description="Returns ordered stages for one project. New is always first and locked.",
    responses=error_responses(401, 403, 422),
)
def get_stages(
    project_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("leads.read")),
) -> ApiResponse[PipelineStageListData]:
    return ApiResponse(data=list_stages(db, actor, project_id), message="Success")


@router.post(
    "",
    response_model=ApiResponse[PipelineStagePublic],
    summary="Add a pipeline stage",
    description="Creates a stage on a project. New cannot be recreated. Owners/admins only.",
    responses=error_responses(401, 403, 409, 422),
)
def post_stage(
    payload: CreatePipelineStageRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("leads.read")),
) -> ApiResponse[PipelineStagePublic]:
    created = create_stage(db, actor, payload, client_ip(request))
    return ApiResponse(data=to_stage_public(created, 0), message=f"{created.label} is added.")


@router.patch(
    "/{stage_id}",
    response_model=ApiResponse[PipelineStagePublic],
    summary="Update a pipeline stage",
    description="Updates a stage. The New stage only allows color changes.",
    responses=error_responses(401, 403, 404, 409, 422),
)
def patch_stage(
    stage_id: uuid.UUID,
    payload: UpdatePipelineStageRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("leads.read")),
) -> ApiResponse[PipelineStagePublic]:
    updated = update_stage(db, actor, stage_id, payload, client_ip(request))
    data = list_stages(db, actor, updated.project_id)
    item = next(
        (row for row in data.items if row.id == str(updated.id)),
        to_stage_public(updated, 0),
    )
    return ApiResponse(data=item, message="Stage updated.")


@router.post(
    "/reorder",
    response_model=ApiResponse[PipelineStageListData],
    summary="Reorder pipeline stages",
    description="Sets column order. New must stay first.",
    responses=error_responses(401, 403, 422),
)
def post_reorder(
    payload: ReorderPipelineStagesRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("leads.read")),
) -> ApiResponse[PipelineStageListData]:
    data = reorder_stages(db, actor, payload, client_ip(request))
    return ApiResponse(data=data, message="Order saved.")


@router.delete(
    "/{stage_id}",
    response_model=ApiResponse[PipelineStageListData],
    summary="Delete a pipeline stage",
    description="Deletes a stage. New cannot be deleted. Pass move_to_stage_key if leads use it.",
    responses=error_responses(401, 403, 404, 409, 422),
)
def remove_stage(
    stage_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("leads.read")),
    move_to_stage_key: str | None = Query(default=None, max_length=40),
) -> ApiResponse[PipelineStageListData]:
    payload = DeletePipelineStageRequest(move_to_stage_key=move_to_stage_key)
    project_id = delete_stage(db, actor, stage_id, payload, client_ip(request))
    return ApiResponse(data=list_stages(db, actor, project_id), message="Stage deleted.")
