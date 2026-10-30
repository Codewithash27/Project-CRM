"""Project routes for the platform operator and the business owner."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import client_ip, get_current_user
from app.common.responses import ApiResponse, error_responses
from app.core.database import get_db
from app.projects.schemas import CompanyOption, CreateProjectRequest, ProjectListData
from app.projects.service import can_create_projects, create_project, list_projects
from app.users.models import User

router = APIRouter()


@router.get(
    "",
    response_model=ApiResponse[ProjectListData],
    summary="List projects",
    description=(
        "A Super Admin sees every project and the businesses that can receive a new one. "
        "A Business Owner sees only the projects of their business."
    ),
    responses=error_responses(401, 403),
)
def get_projects(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[ProjectListData]:
    projects, companies = list_projects(db, actor)
    return ApiResponse(
        data=ProjectListData(
            can_create=can_create_projects(actor),
            companies=[CompanyOption(id=str(company.id), name=company.name, status=company.status) for company in companies],
            items=projects,
        ),
        message="Success",
    )


@router.post(
    "",
    response_model=ApiResponse[ProjectListData],
    summary="Create a project",
    description="A Super Admin creates a project for one business. The short code becomes the lead number prefix.",
    responses=error_responses(401, 403, 422),
)
def post_project(
    payload: CreateProjectRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[ProjectListData]:
    created = create_project(db, actor, payload, client_ip(request))
    projects, companies = list_projects(db, actor)
    return ApiResponse(
        data=ProjectListData(
            can_create=True,
            companies=[CompanyOption(id=str(company.id), name=company.name, status=company.status) for company in companies],
            items=projects,
        ),
        message=f"{created.name} is created. The first lead will be {created.next_lead_number}.",
    )
