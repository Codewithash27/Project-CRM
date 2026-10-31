"""Add sales-facing profile fields on companies.

Revision ID: 0011_company_profile_fields
Revises: 0010_pipeline_stages_per_project
Create Date: 2026-10-31
"""

import sqlalchemy as sa
from alembic import op

revision = "0011_company_profile_fields"
down_revision = "0010_pipeline_stages_per_project"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("industry", sa.String(length=100), nullable=True))
    op.add_column("companies", sa.Column("website", sa.String(length=255), nullable=True))
    op.add_column("companies", sa.Column("email", sa.String(length=150), nullable=True))
    op.add_column("companies", sa.Column("phone", sa.String(length=20), nullable=True))
    op.add_column("companies", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column("companies", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("companies", sa.Column("gst_number", sa.String(length=30), nullable=True))
    op.add_column("companies", sa.Column("remarks", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "remarks")
    op.drop_column("companies", "gst_number")
    op.drop_column("companies", "address")
    op.drop_column("companies", "city")
    op.drop_column("companies", "phone")
    op.drop_column("companies", "email")
    op.drop_column("companies", "website")
    op.drop_column("companies", "industry")
