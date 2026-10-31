"""Lead HTTP routes."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import client_ip, require_permission
from app.common.responses import ApiResponse, error_responses
from app.core.database import get_db
from app.leads.schemas import (
    CreateLeadRequest,
    LeadListData,
    LeadPlanStep,
    LeadPriority,
    LeadPublic,
    UpdateLeadRequest,
    to_lead_public,
)
from app.leads.service import (
    LeadFilters,
    create_lead,
    delete_lead,
    get_lead,
    list_leads,
    project_names_for_leads,
    update_lead,
)
from app.users.models import User

router = APIRouter()


def _public(lead, names: dict):  # type: ignore[no-untyped-def]
    name = None if lead.project_id is None else names.get(lead.project_id)
    return to_lead_public(lead, name)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[LeadPublic],
    summary="Create a lead",
    description=(
        "Creates a lead in the caller's company. The owner defaults to the caller. "
        "Assigning a different owner requires leads.assign. A platform administrator must send company_id "
        "when their own account has no company."
    ),
    responses=error_responses(401, 403, 409, 422),
)
def post_lead(
    payload: CreateLeadRequest,
    request: Request,
    actor: User = Depends(require_permission("leads.create")),
    db: Session = Depends(get_db),
) -> ApiResponse[LeadPublic]:
    created = create_lead(db, actor=actor, payload=payload, ip_address=client_ip(request))
    names = project_names_for_leads(db, [created])
    return ApiResponse(data=_public(created, names), message="Lead created.")


@router.get(
    "",
    response_model=ApiResponse[LeadListData],
    summary="List leads",
    description=(
        "Returns leads visible to the caller. A salesperson sees leads they own. "
        "A business owner sees every lead in their company. A super admin sees every company. "
        "next_followup_at matches that calendar date in UTC. Results are paginated."
    ),
    responses=error_responses(401, 403, 422),
)
def get_leads(
    actor: User = Depends(require_permission("leads.read")),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=100),
    status_filter: str | None = Query(default=None, alias="status", max_length=40),
    owner_id: uuid.UUID | None = Query(default=None),
    source: str | None = Query(default=None, max_length=80),
    priority: LeadPriority | None = Query(default=None),
    next_followup_at: date | None = Query(default=None),
    project_id: uuid.UUID | None = Query(default=None),
    plan_step: LeadPlanStep | None = Query(default=None),
    exclude_lost: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> ApiResponse[LeadListData]:
    leads, total = list_leads(
        db,
        actor=actor,
        filters=LeadFilters(
            search=search,
            status=status_filter,
            owner_id=owner_id,
            source=source,
            priority=priority,
            next_followup_on=next_followup_at,
            project_id=project_id,
            plan_step=plan_step,
            exclude_lost=exclude_lost,
        ),
        limit=limit,
        offset=offset,
    )
    names = project_names_for_leads(db, leads)
    return ApiResponse(
        data=LeadListData(items=[_public(lead, names) for lead in leads], total=total),
        message="Success",
    )


@router.get(
    "/{lead_id}",
    response_model=ApiResponse[LeadPublic],
    summary="Read a lead",
    description="Returns one lead when it is inside the caller's company and ownership scope.",
    responses=error_responses(401, 403, 404),
)
def get_one_lead(
    lead_id: uuid.UUID,
    actor: User = Depends(require_permission("leads.read")),
    db: Session = Depends(get_db),
) -> ApiResponse[LeadPublic]:
    lead = get_lead(db, actor=actor, lead_id=lead_id)
    names = project_names_for_leads(db, [lead])
    return ApiResponse(data=_public(lead, names), message="Success")


@router.patch(
    "/{lead_id}",
    response_model=ApiResponse[LeadPublic],
    summary="Update a lead",
    description=(
        "Updates a lead inside the caller's scope. Changing owner_id assigns the lead and requires "
        "leads.assign. Salespeople cannot assign a lead to someone else."
    ),
    responses=error_responses(401, 403, 404, 422),
)
def patch_lead(
    lead_id: uuid.UUID,
    payload: UpdateLeadRequest,
    request: Request,
    actor: User = Depends(require_permission("leads.update")),
    db: Session = Depends(get_db),
) -> ApiResponse[LeadPublic]:
    updated = update_lead(
        db,
        actor=actor,
        lead_id=lead_id,
        payload=payload,
        ip_address=client_ip(request),
    )
    names = project_names_for_leads(db, [updated])
    return ApiResponse(data=_public(updated, names), message="Lead updated.")


@router.delete(
    "/{lead_id}",
    response_model=ApiResponse[LeadPublic],
    summary="Delete a lead",
    description="Soft-deletes a lead inside the caller's scope by setting is_deleted. The row is kept.",
    responses=error_responses(401, 403, 404),
)
def remove_lead(
    lead_id: uuid.UUID,
    request: Request,
    actor: User = Depends(require_permission("leads.delete")),
    db: Session = Depends(get_db),
) -> ApiResponse[LeadPublic]:
    deleted = delete_lead(db, actor=actor, lead_id=lead_id, ip_address=client_ip(request))
    names = project_names_for_leads(db, [deleted])
    return ApiResponse(data=_public(deleted, names), message="Lead deleted.")
