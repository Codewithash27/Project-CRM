"""Leads and lead permissions.

Revision ID: 0003_leads
Revises: 0002_crm_rbac_foundation
Create Date: 2026-10-30
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_leads"
down_revision = "0002_crm_rbac_foundation"
branch_labels = None
depends_on = None

ROLE_SUPER_ADMIN = "b0000000-0000-4000-8000-000000000001"
ROLE_ADMIN = "b0000000-0000-4000-8000-000000000005"
ROLE_SALES_MANAGER = "b0000000-0000-4000-8000-000000000006"
ROLE_SALES_REP = "b0000000-0000-4000-8000-000000000007"
ROLE_VIEWER = "b0000000-0000-4000-8000-000000000008"

PERM_LEADS_READ = "a0000000-0000-4000-8000-000000000008"
PERM_LEADS_CREATE = "a0000000-0000-4000-8000-000000000009"
PERM_LEADS_UPDATE = "a0000000-0000-4000-8000-000000000010"
PERM_LEADS_ASSIGN = "a0000000-0000-4000-8000-000000000011"
PERM_LEADS_DELETE = "a0000000-0000-4000-8000-000000000012"

LEAD_PERMISSION_IDS = (
    PERM_LEADS_READ,
    PERM_LEADS_CREATE,
    PERM_LEADS_UPDATE,
    PERM_LEADS_ASSIGN,
    PERM_LEADS_DELETE,
)


def upgrade() -> None:
    op.execute(sa.text("CREATE SEQUENCE lead_number_seq AS BIGINT START WITH 1 INCREMENT BY 1"))
    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lead_number", sa.String(length=30), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("mobile", sa.String(length=20), nullable=False),
        sa.Column("alternate_mobile", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=150), nullable=True),
        sa.Column("company_name", sa.String(length=150), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("requirement", sa.Text(), nullable=True),
        sa.Column("expected_value", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("lead_source", sa.String(length=80), nullable=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=30), server_default=sa.text("'new'"), nullable=False),
        sa.Column("priority", sa.String(length=20), server_default=sa.text("'medium'"), nullable=False),
        sa.Column("next_followup_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('new', 'contacted', 'qualified', 'unqualified', 'lost')",
            name="ck_leads_status",
        ),
        sa.CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_leads_priority"),
        sa.CheckConstraint(
            "expected_value IS NULL OR expected_value >= 0",
            name="ck_leads_expected_value",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            ondelete="RESTRICT",
            name="fk_leads_company_id",
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="RESTRICT", name="fk_leads_owner_id"),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name="fk_leads_created_by_id",
        ),
        sa.UniqueConstraint("lead_number", name="uq_leads_lead_number"),
    )
    op.create_index("ix_leads_company_owner_status", "leads", ["company_id", "owner_id", "status"])
    op.create_index("ix_leads_mobile", "leads", ["mobile"])
    op.create_index("ix_leads_email", "leads", ["email"])
    op.create_index("ix_leads_lead_source", "leads", ["lead_source"])
    op.create_index("ix_leads_next_followup_at", "leads", ["next_followup_at"])
    op.create_index("ix_leads_created_at", "leads", ["created_at"])

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
                "id": PERM_LEADS_READ,
                "key": "leads.read",
                "description": "View leads inside the caller's company and ownership scope.",
            },
            {"id": PERM_LEADS_CREATE, "key": "leads.create", "description": "Create leads."},
            {
                "id": PERM_LEADS_UPDATE,
                "key": "leads.update",
                "description": "Update leads inside the caller's scope.",
            },
            {
                "id": PERM_LEADS_ASSIGN,
                "key": "leads.assign",
                "description": "Assign or reassign a lead owner.",
            },
            {"id": PERM_LEADS_DELETE, "key": "leads.delete", "description": "Soft-delete leads."},
        ],
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", postgresql.UUID(as_uuid=True)),
        sa.column("permission_id", postgresql.UUID(as_uuid=True)),
    )
    managed = [PERM_LEADS_READ, PERM_LEADS_CREATE, PERM_LEADS_UPDATE, PERM_LEADS_DELETE]
    full = [*managed, PERM_LEADS_ASSIGN]
    op.bulk_insert(
        role_permissions,
        [{"role_id": ROLE_SUPER_ADMIN, "permission_id": permission_id} for permission_id in full]
        + [{"role_id": ROLE_ADMIN, "permission_id": permission_id} for permission_id in full]
        + [{"role_id": ROLE_SALES_MANAGER, "permission_id": permission_id} for permission_id in full]
        + [{"role_id": ROLE_SALES_REP, "permission_id": permission_id} for permission_id in managed]
        + [{"role_id": ROLE_VIEWER, "permission_id": PERM_LEADS_READ}],
    )


def downgrade() -> None:
    ids = ", ".join(f"'{permission_id}'" for permission_id in LEAD_PERMISSION_IDS)
    op.execute(f"DELETE FROM role_permissions WHERE permission_id IN ({ids})")
    op.execute(f"DELETE FROM permissions WHERE id IN ({ids})")
    op.drop_table("leads")
    op.execute(sa.text("DROP SEQUENCE IF EXISTS lead_number_seq"))
