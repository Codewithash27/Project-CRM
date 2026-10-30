"""Add roles.create and roles.update for Super Admin role design.

Revision ID: 0005_roles_manage_permissions
Revises: 0004_projects_and_demo_leads
Create Date: 2026-10-30
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005_roles_manage_permissions"
down_revision = "0004_projects_and_demo_leads"
branch_labels = None
depends_on = None

ROLE_SUPER_ADMIN = "b0000000-0000-4000-8000-000000000001"
PERM_ROLES_CREATE = "a0000000-0000-4000-8000-000000000020"
PERM_ROLES_UPDATE = "a0000000-0000-4000-8000-000000000021"


def upgrade() -> None:
    permissions = sa.table(
        "permissions",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("key", sa.String),
        sa.column("description", sa.Text),
    )
    op.bulk_insert(
        permissions,
        [
            {
                "id": PERM_ROLES_CREATE,
                "key": "roles.create",
                "description": "Create custom roles and choose their permissions.",
            },
            {
                "id": PERM_ROLES_UPDATE,
                "key": "roles.update",
                "description": "Change which permissions a role has.",
            },
        ],
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", postgresql.UUID(as_uuid=True)),
        sa.column("permission_id", postgresql.UUID(as_uuid=True)),
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role_id": ROLE_SUPER_ADMIN, "permission_id": PERM_ROLES_CREATE},
            {"role_id": ROLE_SUPER_ADMIN, "permission_id": PERM_ROLES_UPDATE},
        ],
    )


def downgrade() -> None:
    ids = ", ".join(f"'{permission_id}'" for permission_id in (PERM_ROLES_CREATE, PERM_ROLES_UPDATE))
    op.execute(f"DELETE FROM role_permissions WHERE permission_id IN ({ids})")
    op.execute(f"DELETE FROM permissions WHERE id IN ({ids})")
