"""Company pipeline stages and lead status keys.

Revision ID: 0009_pipeline_stages
Revises: 0008_lead_fields
Create Date: 2026-10-30
"""

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009_pipeline_stages"
down_revision = "0008_lead_fields"
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

STATUS_MAP = (
    ("New", "new"),
    ("new", "new"),
    ("Contacted", "contacted"),
    ("contacted", "contacted"),
    ("In Progress", "in_progress"),
    ("Qualified", "qualified"),
    ("qualified", "qualified"),
    ("Won", "won"),
    ("Lost", "lost"),
    ("lost", "lost"),
    ("Nurture", "nurture"),
    ("unqualified", "lost"),
)


def upgrade() -> None:
    op.create_table(
        "pipeline_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=False),
        sa.Column("color", sa.String(length=7), server_default=sa.text("'#64748b'"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("is_entry", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_won", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_lost", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("company_id", "key", name="uq_pipeline_stages_company_key"),
    )
    op.create_index("ix_pipeline_stages_company_sort", "pipeline_stages", ["company_id", "sort_order"])

    bind = op.get_bind()
    companies = bind.execute(sa.text("SELECT id FROM companies")).scalars().all()
    for company_id in companies:
        for index, (key, label, color, is_entry, is_won, is_lost) in enumerate(DEFAULT_STAGES, start=1):
            bind.execute(
                sa.text(
                    "INSERT INTO pipeline_stages "
                    "(id, company_id, key, label, color, sort_order, is_entry, is_won, is_lost) "
                    "VALUES (:id, :company_id, :key, :label, :color, :sort_order, "
                    ":is_entry, :is_won, :is_lost)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "company_id": company_id,
                    "key": key,
                    "label": label,
                    "color": color,
                    "sort_order": index,
                    "is_entry": is_entry,
                    "is_won": is_won,
                    "is_lost": is_lost,
                },
            )

    op.drop_constraint("ck_leads_status", "leads", type_="check")
    for old, new in STATUS_MAP:
        bind.execute(
            sa.text("UPDATE leads SET status = :new WHERE status = :old"),
            {"old": old, "new": new},
        )


def downgrade() -> None:
    bind = op.get_bind()
    reverse = {
        "in_progress": "In Progress",
        "won": "Won",
        "nurture": "Nurture",
        "new": "New",
        "contacted": "Contacted",
        "qualified": "Qualified",
        "lost": "Lost",
    }
    for new, old in reverse.items():
        bind.execute(
            sa.text("UPDATE leads SET status = :old WHERE status = :new"),
            {"old": old, "new": new},
        )
    op.create_check_constraint(
        "ck_leads_status",
        "leads",
        "status IN ('new', 'contacted', 'qualified', 'unqualified', 'lost', "
        "'New', 'Contacted', 'In Progress', 'Qualified', 'Won', 'Lost', 'Nurture')",
    )
    op.drop_index("ix_pipeline_stages_company_sort", table_name="pipeline_stages")
    op.drop_table("pipeline_stages")
