"""Compute KPI snapshot for leads visible to the caller."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.kpis.schemas import KpiMetric, KpiOverviewData, QuickPulse, StageShare
from app.leads.models import Lead
from app.leads.schemas import normalize_status
from app.leads.service import LeadFilters, list_leads
from app.users.models import User

STATUS_LABELS = {
    "new": "New",
    "contacted": "Contacted",
    "in_progress": "In Progress",
    "qualified": "Qualified",
    "won": "Won",
    "lost": "Lost",
    "nurture": "Nurture",
}

STAGE_ORDER = ["new", "contacted", "in_progress", "qualified", "nurture", "won", "lost"]


def _money(value: Decimal | float | int) -> str:
    amount = Decimal(value).quantize(Decimal("0.01"))
    return f"₹{amount:,.2f}"


def _start_of_today_utc() -> datetime:
    now = datetime.now(UTC)
    return datetime(now.year, now.month, now.day, tzinfo=UTC)


def _won_value(lead: Lead) -> Decimal:
    if lead.order_amount is not None:
        return Decimal(lead.order_amount)
    if lead.expected_value is not None:
        return Decimal(lead.expected_value)
    return Decimal("0")


def build_kpi_overview(db: Session, *, actor: User) -> KpiOverviewData:
    # Pull full visible set in pages so totals are never first-page-only.
    items: list[Lead] = []
    offset = 0
    page = 500
    while True:
        batch, total = list_leads(
            db,
            actor=actor,
            filters=LeadFilters(),
            limit=page,
            offset=offset,
        )
        items.extend(batch)
        offset += len(batch)
        if offset >= total or not batch:
            break

    today = _start_of_today_utc()
    tomorrow = today + timedelta(days=1)
    total = len(items)
    status_counts: Counter[str] = Counter()
    source_counts: Counter[str] = Counter()
    new_count = 0
    qualified_count = 0
    won_count = 0
    followups_due = 0
    overdue = 0
    due_today = 0
    won_sum = Decimal("0")
    pipeline_sum = Decimal("0")

    for lead in items:
        status = normalize_status(lead.status)
        status_counts[status] += 1
        if lead.lead_source:
            source_counts[lead.lead_source] += 1
        if status == "new":
            new_count += 1
        if status == "qualified":
            qualified_count += 1
        if status == "won":
            won_count += 1
            won_sum += _won_value(lead)
        elif status != "lost":
            if lead.expected_value is not None:
                pipeline_sum += Decimal(lead.expected_value)
        due = lead.next_followup_at
        if due is not None:
            if due.tzinfo is None:
                due = due.replace(tzinfo=UTC)
            if due < today:
                overdue += 1
                followups_due += 1
            elif due < tomorrow:
                due_today += 1
                followups_due += 1

    conversion = 0.0 if total == 0 else round((won_count / total) * 100, 1)
    top_source = None
    top_source_count = 0
    if source_counts:
        top_source, top_source_count = source_counts.most_common(1)[0]

    metrics = [
        KpiMetric(key="total", label="Total leads", value=str(total), badge="Live total"),
        KpiMetric(key="new", label="New leads", value=str(new_count), badge="Live total"),
        KpiMetric(key="qualified", label="Qualified", value=str(qualified_count), badge="Live total"),
        KpiMetric(key="followups_due", label="Follow-ups due", value=str(followups_due), badge="Needs attention"),
        KpiMetric(key="won", label="Won deals", value=str(won_count), badge="Performance"),
        KpiMetric(key="won_value", label="Won value", value=_money(won_sum), badge="Performance"),
        KpiMetric(key="pipeline_value", label="Pipeline value", value=_money(pipeline_sum), badge="Live total"),
        KpiMetric(key="overdue", label="Overdue reminders", value=str(overdue), badge="Needs attention"),
    ]

    stages: list[StageShare] = []
    for key in STAGE_ORDER:
        count = status_counts.get(key, 0)
        if count == 0 and key not in status_counts:
            # Still show common stages with 0 so the overview is stable.
            if key in ("unqualified",):
                continue
        percent = 0.0 if total == 0 else round((count / total) * 100, 1)
        stages.append(
            StageShare(
                status=key,
                label=STATUS_LABELS.get(key, key.replace("_", " ").title()),
                count=count,
                percent=percent,
            )
        )
    # Include any unexpected statuses.
    for key, count in status_counts.items():
        if key in STAGE_ORDER:
            continue
        percent = 0.0 if total == 0 else round((count / total) * 100, 1)
        stages.append(
            StageShare(
                status=key,
                label=STATUS_LABELS.get(key, key.replace("_", " ").title()),
                count=count,
                percent=percent,
            )
        )

    return KpiOverviewData(
        metrics=metrics,
        stages=stages,
        pulse=QuickPulse(
            due_today=due_today,
            overdue=overdue,
            conversion_rate=conversion,
            top_source=top_source,
            top_source_count=top_source_count,
        ),
    )
