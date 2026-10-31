"""Allow custom follow-up plan step labels on leads.

Revision ID: 0014_custom_followup_plan_steps
Revises: 0013_followup_plan_steps
"""

from alembic import op

revision = "0014_custom_followup_plan_steps"
down_revision = "0013_followup_plan_steps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_leads_plan_step", "leads", type_="check")


def downgrade() -> None:
    op.execute(
        """
        UPDATE leads
        SET plan_step = 'Day 1'
        WHERE plan_step NOT IN ('Day 1', 'Day 3', 'Day 7', 'Day 21', '3-month review', 'Custom')
        """
    )
    op.create_check_constraint(
        "ck_leads_plan_step",
        "leads",
        "plan_step IN ('Day 1', 'Day 3', 'Day 7', 'Day 21', '3-month review', 'Custom')",
    )
