"""Company, team, and CRM role foundation.

Revision ID: 0002_crm_rbac_foundation
Revises: 0001_auth_foundation
Create Date: 2026-10-30
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_crm_rbac_foundation"
down_revision = "0001_auth_foundation"
branch_labels = None
depends_on = None

ROLE_ADMIN = "b0000000-0000-4000-8000-000000000005"
ROLE_SALES_MANAGER = "b0000000-0000-4000-8000-000000000006"
ROLE_SALES_REP = "b0000000-0000-4000-8000-000000000007"
ROLE_VIEWER = "b0000000-0000-4000-8000-000000000008"

PERM_USERS_READ = "a0000000-0000-4000-8000-000000000001"
PERM_USERS_CREATE = "a0000000-0000-4000-8000-000000000002"
PERM_USERS_UPDATE = "a0000000-0000-4000-8000-000000000003"
PERM_USERS_DELETE = "a0000000-0000-4000-8000-000000000004"
PERM_ROLES_READ = "a0000000-0000-4000-8000-000000000005"
PERM_ROLES_ASSIGN = "a0000000-0000-4000-8000-000000000006"
PERM_FEATURES_READ = "a0000000-0000-4000-8000-000000000007"

NEW_ROLE_IDS = (ROLE_ADMIN, ROLE_SALES_MANAGER, ROLE_SALES_REP, ROLE_VIEWER)


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('active', 'inactive')", name="ck_companies_status"),
    )
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('active', 'inactive')", name="ck_teams_status"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT", name="fk_teams_company_id"),
        sa.ForeignKeyConstraint(["manager_id"], ["users.id"], ondelete="SET NULL", name="fk_teams_manager_id"),
    )
    op.create_index("ix_teams_company_id", "teams", ["company_id"])
    op.create_index("ix_teams_manager_id", "teams", ["manager_id"])

    op.add_column("users", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("users", sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("users", sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_users_company_id", "users", "companies", ["company_id"], ["id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_users_team_id", "users", "teams", ["team_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_users_manager_id", "users", "users", ["manager_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_users_company_id", "users", ["company_id"])
    op.create_index("ix_users_team_id", "users", ["team_id"])
    op.create_index("ix_users_manager_id", "users", ["manager_id"])

    roles = sa.table(
        "roles",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
    )
    op.bulk_insert(
        roles,
        [
            {
                "id": ROLE_ADMIN,
                "name": "ADMIN",
                "description": "Company administrator. Sees all records in their company and manages its users.",
            },
            {
                "id": ROLE_SALES_MANAGER,
                "name": "SALES_MANAGER",
                "description": "Sales manager. Sees own records and records owned by their team.",
            },
            {
                "id": ROLE_SALES_REP,
                "name": "SALES_REP",
                "description": "Sales representative. Sees only records they own.",
            },
            {
                "id": ROLE_VIEWER,
                "name": "VIEWER",
                "description": "Read-only company member. Sees only records they own.",
            },
        ],
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", postgresql.UUID(as_uuid=True)),
        sa.column("permission_id", postgresql.UUID(as_uuid=True)),
    )
    admin_permissions = [
        PERM_USERS_READ,
        PERM_USERS_CREATE,
        PERM_USERS_UPDATE,
        PERM_USERS_DELETE,
        PERM_ROLES_READ,
        PERM_ROLES_ASSIGN,
        PERM_FEATURES_READ,
    ]
    op.bulk_insert(
        role_permissions,
        [{"role_id": ROLE_ADMIN, "permission_id": permission_id} for permission_id in admin_permissions]
        + [
            {"role_id": ROLE_SALES_MANAGER, "permission_id": PERM_FEATURES_READ},
            {"role_id": ROLE_SALES_REP, "permission_id": PERM_FEATURES_READ},
            {"role_id": ROLE_VIEWER, "permission_id": PERM_FEATURES_READ},
        ],
    )


def downgrade() -> None:
    ids = ", ".join(f"'{role_id}'" for role_id in NEW_ROLE_IDS)
    op.execute(f"DELETE FROM role_permissions WHERE role_id IN ({ids})")
    op.execute(f"DELETE FROM user_roles WHERE role_id IN ({ids})")
    op.execute(f"DELETE FROM roles WHERE id IN ({ids})")

    op.drop_index("ix_users_manager_id", table_name="users")
    op.drop_index("ix_users_team_id", table_name="users")
    op.drop_index("ix_users_company_id", table_name="users")
    op.drop_constraint("fk_users_manager_id", "users", type_="foreignkey")
    op.drop_constraint("fk_users_team_id", "users", type_="foreignkey")
    op.drop_constraint("fk_users_company_id", "users", type_="foreignkey")
    op.drop_column("users", "manager_id")
    op.drop_column("users", "team_id")
    op.drop_column("users", "company_id")
    op.drop_table("teams")
    op.drop_table("companies")
