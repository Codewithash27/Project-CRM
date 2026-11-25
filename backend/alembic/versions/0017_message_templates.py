"""User mobile number and company WhatsApp templates.

Revision ID: 0017_message_templates
Revises: 0016_lead_calls
Create Date: 2026-11-25
"""

import uuid
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0017_message_templates"
down_revision = "0016_lead_calls"
branch_labels = None
depends_on = None

_DEFAULTS = (
    ("Welcome", "Hi {name}, thank you for your enquiry. How can I help you today?"),
    ("Follow-up", "Hi {name}, I am following up on our last conversation. Please let me know a good time to talk."),
    ("Thank you", "Hi {name}, thank you for your time. Message me if you need anything else."),
)


def upgrade() -> None:
    op.add_column("users", sa.Column("mobile", sa.String(length=20), nullable=True))
    op.create_table(
        "message_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("image_name", sa.String(length=255), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            ondelete="CASCADE",
            name="fk_message_templates_company_id",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_message_templates_created_by_id",
        ),
    )
    op.create_index("ix_message_templates_company_id", "message_templates", ["company_id"])
    op.execute(
        "CREATE UNIQUE INDEX uq_message_templates_company_title "
        "ON message_templates (company_id, lower(title))"
    )
    bind = op.get_bind()
    company_ids = bind.execute(sa.text("SELECT id FROM companies")).scalars().all()
    now = datetime.now(UTC)
    for company_id in company_ids:
        for title, message in _DEFAULTS:
            bind.execute(
                sa.text(
                    "INSERT INTO message_templates "
                    "(id, company_id, title, message, image_name, created_by_id, created_at, updated_at) "
                    "VALUES (:id, :company_id, :title, :message, NULL, NULL, :now, :now)"
                ),
                {
                    "id": uuid.uuid4(),
                    "company_id": company_id,
                    "title": title,
                    "message": message,
                    "now": now,
                },
            )


def downgrade() -> None:
    op.drop_index("uq_message_templates_company_title", table_name="message_templates")
    op.drop_index("ix_message_templates_company_id", table_name="message_templates")
    op.drop_table("message_templates")
    op.drop_column("users", "mobile")
