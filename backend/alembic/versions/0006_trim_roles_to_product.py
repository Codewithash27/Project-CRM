"""Keep only Super Admin, Business Owner, Salesperson, Marketing.

Revision ID: 0006_trim_roles_to_product
Revises: 0005_roles_manage_permissions
Create Date: 2026-10-30

Moves users off removed roles, grants lead permissions to the kept sales
roles, then deletes ADMIN, SALES_MANAGER, SALES_REP, and VIEWER.
"""

from alembic import op

revision = "0006_trim_roles_to_product"
down_revision = "0005_roles_manage_permissions"
branch_labels = None
depends_on = None

ROLE_BUSINESS_OWNER = "b0000000-0000-4000-8000-000000000002"
ROLE_SALESPERSON = "b0000000-0000-4000-8000-000000000003"
ROLE_ADMIN = "b0000000-0000-4000-8000-000000000005"
ROLE_SALES_MANAGER = "b0000000-0000-4000-8000-000000000006"
ROLE_SALES_REP = "b0000000-0000-4000-8000-000000000007"
ROLE_VIEWER = "b0000000-0000-4000-8000-000000000008"

PERM_LEADS_READ = "a0000000-0000-4000-8000-000000000008"
PERM_LEADS_CREATE = "a0000000-0000-4000-8000-000000000009"
PERM_LEADS_UPDATE = "a0000000-0000-4000-8000-000000000010"
PERM_LEADS_ASSIGN = "a0000000-0000-4000-8000-000000000011"
PERM_LEADS_DELETE = "a0000000-0000-4000-8000-000000000012"

REMOVED = (ROLE_ADMIN, ROLE_SALES_MANAGER, ROLE_SALES_REP, ROLE_VIEWER)


def upgrade() -> None:
    op.execute(
        f"""
        INSERT INTO user_roles (user_id, role_id)
        SELECT ur.user_id, '{ROLE_BUSINESS_OWNER}'::uuid
        FROM user_roles ur
        WHERE ur.role_id = '{ROLE_ADMIN}'::uuid
          AND NOT EXISTS (
            SELECT 1 FROM user_roles existing
            WHERE existing.user_id = ur.user_id
              AND existing.role_id = '{ROLE_BUSINESS_OWNER}'::uuid
          )
        """
    )
    op.execute(
        f"""
        INSERT INTO user_roles (user_id, role_id)
        SELECT DISTINCT ur.user_id, '{ROLE_SALESPERSON}'::uuid
        FROM user_roles ur
        WHERE ur.role_id IN (
          '{ROLE_SALES_MANAGER}'::uuid,
          '{ROLE_SALES_REP}'::uuid,
          '{ROLE_VIEWER}'::uuid
        )
          AND NOT EXISTS (
            SELECT 1 FROM user_roles existing
            WHERE existing.user_id = ur.user_id
              AND existing.role_id = '{ROLE_SALESPERSON}'::uuid
          )
        """
    )
    removed_ids = ", ".join(f"'{role_id}'::uuid" for role_id in REMOVED)
    op.execute(f"DELETE FROM user_roles WHERE role_id IN ({removed_ids})")

    for role_id, permission_id in (
        (ROLE_BUSINESS_OWNER, PERM_LEADS_READ),
        (ROLE_BUSINESS_OWNER, PERM_LEADS_ASSIGN),
        (ROLE_SALESPERSON, PERM_LEADS_READ),
        (ROLE_SALESPERSON, PERM_LEADS_CREATE),
        (ROLE_SALESPERSON, PERM_LEADS_UPDATE),
        (ROLE_SALESPERSON, PERM_LEADS_DELETE),
    ):
        op.execute(
            f"""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT '{role_id}'::uuid, '{permission_id}'::uuid
            WHERE NOT EXISTS (
              SELECT 1 FROM role_permissions
              WHERE role_id = '{role_id}'::uuid AND permission_id = '{permission_id}'::uuid
            )
            """
        )

    op.execute(f"DELETE FROM role_permissions WHERE role_id IN ({removed_ids})")
    op.execute(f"DELETE FROM roles WHERE id IN ({removed_ids})")


def downgrade() -> None:
    pass
