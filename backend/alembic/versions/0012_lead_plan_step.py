"""Add follow-up plan_step on leads.

Revision ID: 0012_lead_plan_step
Revises: 0011_company_profile_fields
Create Date: 2026-10-31
"""

import sqlalchemy as sa
from alembic import op

revision = "0012_lead_plan_step"
down_revision = "0011_company_profile_fields"
branch_labels = None
depends_on = None

PLAN_STEPS = ("Call 1", "Call 2", "Visit")


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column("plan_step", sa.String(length=20), nullable=False, server_default="Call 1"),
    )
    op.create_check_constraint(
        "ck_leads_plan_step",
        "leads",
        "plan_step IN ('Call 1', 'Call 2', 'Visit')",
    )
    op.create_index("ix_leads_plan_step", "leads", ["plan_step"])
    # Spread demo rows across steps so Follow-ups filter is usable.
    op.execute(
        """
        UPDATE leads
        SET plan_step = CASE
            WHEN mod(abs(hashtext(lead_number::text)), 3) = 0 THEN 'Call 1'
            WHEN mod(abs(hashtext(lead_number::text)), 3) = 1 THEN 'Call 2'
            ELSE 'Visit'
        END
        WHERE is_deleted = false
        """
    )


def downgrade() -> None:
    op.drop_index("ix_leads_plan_step", table_name="leads")
    op.drop_constraint("ck_leads_plan_step", "leads", type_="check")
    op.drop_column("leads", "plan_step")
