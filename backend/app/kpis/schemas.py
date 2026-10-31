"""KPI overview response schemas."""

from pydantic import BaseModel


class KpiMetric(BaseModel):
    key: str
    label: str
    value: str
    badge: str


class StageShare(BaseModel):
    status: str
    label: str
    count: int
    percent: float


class QuickPulse(BaseModel):
    due_today: int
    overdue: int
    conversion_rate: float
    top_source: str | None
    top_source_count: int


class KpiOverviewData(BaseModel):
    metrics: list[KpiMetric]
    stages: list[StageShare]
    pulse: QuickPulse
