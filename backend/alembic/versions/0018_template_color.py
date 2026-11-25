"""Template accent color.

Revision ID: 0018_template_color
Revises: 0017_message_templates
Create Date: 2026-11-25
"""

import sqlalchemy as sa
from alembic import op

revision = "0018_template_color"
down_revision = "0017_message_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "message_templates",
        sa.Column("color", sa.String(length=7), nullable=False, server_default="#128C7E"),
    )
    op.execute("UPDATE message_templates SET color = '#1D4ED8' WHERE lower(title) = 'follow-up'")
    op.execute("UPDATE message_templates SET color = '#7C3AED' WHERE lower(title) = 'thank you'")


def downgrade() -> None:
    op.drop_column("message_templates", "color")
