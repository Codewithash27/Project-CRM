"""Backfill project_members for business owners of each project company.

Revision ID: 0007_project_owner_members
Revises: 0006_trim_roles_to_product
Create Date: 2026-10-30
"""

from alembic import op

revision = "0007_project_owner_members"
down_revision = "0006_trim_roles_to_product"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO project_members (project_id, user_id, assigned_by_id, created_at)
        SELECT p.id, u.id, NULL, NOW()
        FROM projects p
        JOIN users u ON u.company_id = p.company_id AND u.is_active IS TRUE
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id AND r.name = 'BUSINESS_OWNER'
        WHERE NOT EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = u.id
        )
        """
    )


def downgrade() -> None:
    pass
