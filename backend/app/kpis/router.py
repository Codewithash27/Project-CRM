"""KPI HTTP routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import require_permission
from app.common.responses import ApiResponse, error_responses
from app.core.database import get_db
from app.kpis.schemas import KpiOverviewData
from app.kpis.service import build_kpi_overview
from app.users.models import User

router = APIRouter()


@router.get(
    "",
    response_model=ApiResponse[KpiOverviewData],
    summary="KPI overview",
    description="Live counts and values for leads visible to the caller.",
    responses=error_responses(401, 403),
)
def get_kpis(
    actor: User = Depends(require_permission("leads.read")),
    db: Session = Depends(get_db),
) -> ApiResponse[KpiOverviewData]:
    return ApiResponse(data=build_kpi_overview(db, actor=actor), message="Success")
