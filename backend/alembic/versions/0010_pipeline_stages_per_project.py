"""Move pipeline stages from company to project. New stays locked per project.

Revision ID: 0010_pipeline_stages_per_project
Revises: 0009_pipeline_stages
Create Date: 2026-10-31
"""

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010_pipeline_stages_per_project"
down_revision = "0009_pipeline_stages"
branch_labels = None
depends_on = None

DEFAULT_STAGES = (
    ("new", "New", "#93c5fd", True, False, False),
    ("contacted", "Contacted", "#60a5fa", False, False, False),
    ("in_progress", "In Progress", "#f59e0b", False, False, False),
    ("qualified", "Qualified", "#34d399", False, False, False),
    ("won", "Won", "#10b981", False, True, False),
    ("lost", "Lost", "#f87171", False, False, True),
    ("nurture", "Nurture", "#a78bfa", False, False, False),
)


def upgrade() -> None:
    op.add_column(
        "pipeline_stages",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute("DELETE FROM pipeline_stages")
    op.drop_constraint("uq_pipeline_stages_company_key", "pipeline_stages", type_="unique")
    op.drop_index("ix_pipeline_stages_company_sort", table_name="pipeline_stages")
    op.drop_constraint("pipeline_stages_company_id_fkey", "pipeline_stages", type_="foreignkey")
    op.drop_column("pipeline_stages", "company_id")

    op.create_foreign_key(
        "fk_pipeline_stages_project_id",
        "pipeline_stages",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.alter_column("pipeline_stages", "project_id", nullable=False)
    op.create_unique_constraint(
        "uq_pipeline_stages_project_key",
        "pipeline_stages",
        ["project_id", "key"],
    )
    op.create_index(
        "ix_pipeline_stages_project_sort",
        "pipeline_stages",
        ["project_id", "sort_order"],
    )

    bind = op.get_bind()
    projects = bind.execute(sa.text("SELECT id FROM projects")).scalars().all()
    for project_id in projects:
        for index, (key, label, color, is_entry, is_won, is_lost) in enumerate(DEFAULT_STAGES, start=1):
            bind.execute(
                sa.text(
                    "INSERT INTO pipeline_stages "
                    "(id, project_id, key, label, color, sort_order, is_entry, is_won, is_lost) "
                    "VALUES (:id, :project_id, :key, :label, :color, :sort_order, "
                    ":is_entry, :is_won, :is_lost)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "project_id": project_id,
                    "key": key,
                    "label": label,
                    "color": color,
                    "sort_order": index,
                    "is_entry": is_entry,
                    "is_won": is_won,
                    "is_lost": is_lost,
                },
            )


def downgrade() -> None:
    op.execute("DELETE FROM pipeline_stages")
    op.drop_index("ix_pipeline_stages_project_sort", table_name="pipeline_stages")
    op.drop_constraint("uq_pipeline_stages_project_key", "pipeline_stages", type_="unique")
    op.drop_constraint("fk_pipeline_stages_project_id", "pipeline_stages", type_="foreignkey")
    op.drop_column("pipeline_stages", "project_id")
    op.add_column(
        "pipeline_stages",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "pipeline_stages_company_id_fkey",
        "pipeline_stages",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.alter_column("pipeline_stages", "company_id", nullable=False)
    op.create_unique_constraint(
        "uq_pipeline_stages_company_key",
        "pipeline_stages",
        ["company_id", "key"],
    )
    op.create_index(
        "ix_pipeline_stages_company_sort",
        "pipeline_stages",
        ["company_id", "sort_order"],
    )
