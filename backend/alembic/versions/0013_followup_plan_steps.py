"""Replace Call/Visit plan steps with Day cadence steps.

Revision ID: 0013_followup_plan_steps
Revises: 0012_lead_plan_step
Create Date: 2026-10-31
"""

import sqlalchemy as sa
from alembic import op

revision = "0013_followup_plan_steps"
down_revision = "0012_lead_plan_step"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_leads_plan_step", "leads", type_="check")
    op.alter_column(
        "leads",
        "plan_step",
        existing_type=sa.String(length=20),
        type_=sa.String(length=40),
        existing_nullable=False,
        server_default="Day 1",
    )
    op.execute(
        """
        UPDATE leads SET plan_step = CASE plan_step
            WHEN 'Call 1' THEN 'Day 1'
            WHEN 'Call 2' THEN 'Day 3'
            WHEN 'Visit' THEN 'Day 7'
            ELSE plan_step
        END
        """
    )
    op.execute(
        """
        UPDATE leads
        SET plan_step = CASE mod(abs(hashtext(lead_number::text)), 6)
            WHEN 0 THEN 'Day 1'
            WHEN 1 THEN 'Day 3'
            WHEN 2 THEN 'Day 7'
            WHEN 3 THEN 'Day 21'
            WHEN 4 THEN '3-month review'
            ELSE 'Custom'
        END
        WHERE is_deleted = false
        """
    )
    op.create_check_constraint(
        "ck_leads_plan_step",
        "leads",
        "plan_step IN ('Day 1', 'Day 3', 'Day 7', 'Day 21', '3-month review', 'Custom')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_leads_plan_step", "leads", type_="check")
    op.execute(
        """
        UPDATE leads SET plan_step = CASE plan_step
            WHEN 'Day 1' THEN 'Call 1'
            WHEN 'Day 3' THEN 'Call 2'
            WHEN 'Day 7' THEN 'Visit'
            WHEN 'Day 21' THEN 'Visit'
            WHEN '3-month review' THEN 'Visit'
            WHEN 'Custom' THEN 'Call 1'
            ELSE 'Call 1'
        END
        """
    )
    op.alter_column(
        "leads",
        "plan_step",
        existing_type=sa.String(length=40),
        type_=sa.String(length=20),
        existing_nullable=False,
        server_default="Call 1",
    )
    op.create_check_constraint(
        "ck_leads_plan_step",
        "leads",
        "plan_step IN ('Call 1', 'Call 2', 'Visit')",
    )
