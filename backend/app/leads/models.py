"""Lead persistence. Tasks, activities, and deals are separate modules."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.core.database import Base

NEW = "new"
CONTACTED = "contacted"
QUALIFIED = "qualified"
UNQUALIFIED = "unqualified"
LOST = "lost"
STATUSES = (NEW, CONTACTED, QUALIFIED, UNQUALIFIED, LOST)

LOW = "low"
MEDIUM = "medium"
HIGH = "high"
PRIORITIES = (LOW, MEDIUM, HIGH)


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint(
            "status IN ('new', 'contacted', 'qualified', 'unqualified', 'lost')",
            name="ck_leads_status",
        ),
        CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_leads_priority"),
        CheckConstraint(
            "expected_value IS NULL OR expected_value >= 0",
            name="ck_leads_expected_value",
        ),
        UniqueConstraint("lead_number", name="uq_leads_lead_number"),
        Index("ix_leads_company_owner_status", "company_id", "owner_id", "status"),
        Index("ix_leads_mobile", "mobile"),
        Index("ix_leads_email", "email"),
        Index("ix_leads_lead_source", "lead_source"),
        Index("ix_leads_next_followup_at", "next_followup_at"),
        Index("ix_leads_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("companies.id", ondelete="RESTRICT"),
        nullable=False,
    )
    lead_number: Mapped[str] = mapped_column(String(30), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    alternate_mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirement: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    lead_source: Mapped[str | None] = mapped_column(String(80), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default=text("'new'"))
    priority: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'medium'"))
    next_followup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
