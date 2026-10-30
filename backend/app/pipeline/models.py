"""Pipeline stage persistence. Stages are scoped to one project. New is locked."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.core.database import Base

ENTRY_KEY = "new"


class PipelineStage(Base):
    __tablename__ = "pipeline_stages"
    __table_args__ = (
        UniqueConstraint("project_id", "key", name="uq_pipeline_stages_project_key"),
        Index("ix_pipeline_stages_project_sort", "project_id", "sort_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    key: Mapped[str] = mapped_column(String(40), nullable=False)
    label: Mapped[str] = mapped_column(String(40), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, server_default=text("'#64748b'"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    is_entry: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    is_won: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    is_lost: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
