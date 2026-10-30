"""Lead field definitions and lead.extra_values.

Revision ID: 0008_lead_fields
Revises: 0007_project_owner_members
Create Date: 2026-10-30

Seeds the Preschool demo fields from the product prototype.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008_lead_fields"
down_revision = "0007_project_owner_members"
branch_labels = None
depends_on = None

P_AADI_PRESCHOOL = "44444444-4444-4444-8444-444444444403"
P_AADI_PANEER = "44444444-4444-4444-8444-444444444401"
P_SPICE_PANEER = "44444444-4444-4444-8444-444444444405"
P_AADI_HIRING = "44444444-4444-4444-8444-444444444402"

FIELD_IDS = (
    "55555555-5555-4555-8555-555555555501",
    "55555555-5555-4555-8555-555555555502",
    "55555555-5555-4555-8555-555555555503",
    "55555555-5555-4555-8555-555555555504",
    "55555555-5555-4555-8555-555555555505",
    "55555555-5555-4555-8555-555555555511",
    "55555555-5555-4555-8555-555555555512",
    "55555555-5555-4555-8555-555555555513",
    "55555555-5555-4555-8555-555555555521",
    "55555555-5555-4555-8555-555555555522",
    "55555555-5555-4555-8555-555555555523",
    "55555555-5555-4555-8555-555555555531",
)


def upgrade() -> None:
    op.create_table(
        "lead_fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=False),
        sa.Column("field_type", sa.String(length=20), nullable=False),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("show_in_list", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "field_type IN ("
            "'text', 'area', 'number', 'email', 'phone', 'select', 'multi', "
            "'radio', 'check', 'date', 'url')",
            name="ck_lead_fields_field_type",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
            name="fk_lead_fields_project_id",
        ),
        sa.UniqueConstraint("project_id", "key", name="uq_lead_fields_project_key"),
    )
    op.create_index("ix_lead_fields_project_sort", "lead_fields", ["project_id", "sort_order"])

    op.add_column(
        "leads",
        sa.Column("extra_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    # Demo seed only when those projects already exist (skipped on empty test DBs).
    conn = op.get_bind()
    existing = {
        str(row[0])
        for row in conn.execute(
            sa.text(
                "SELECT id FROM projects WHERE id IN ("
                f"'{P_AADI_PRESCHOOL}', '{P_AADI_PANEER}', '{P_SPICE_PANEER}', '{P_AADI_HIRING}')"
            )
        )
    }
    if not existing:
        return

    lead_fields = sa.table(
        "lead_fields",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("project_id", postgresql.UUID(as_uuid=True)),
        sa.column("key", sa.String()),
        sa.column("label", sa.String()),
        sa.column("field_type", sa.String()),
        sa.column("options", postgresql.JSONB()),
        sa.column("is_required", sa.Boolean()),
        sa.column("show_in_list", sa.Boolean()),
        sa.column("is_active", sa.Boolean()),
        sa.column("sort_order", sa.Integer()),
    )

    rows = [
        # Preschool (matches the prototype screenshot)
        {
            "id": FIELD_IDS[0],
            "project_id": P_AADI_PRESCHOOL,
            "key": "web",
            "label": "Website",
            "field_type": "text",
            "options": None,
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 1,
        },
        {
            "id": FIELD_IDS[1],
            "project_id": P_AADI_PRESCHOOL,
            "key": "sell",
            "label": "Selling point",
            "field_type": "text",
            "options": None,
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 2,
        },
        {
            "id": FIELD_IDS[2],
            "project_id": P_AADI_PRESCHOOL,
            "key": "prod",
            "label": "Interested product",
            "field_type": "text",
            "options": None,
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 3,
        },
        {
            "id": FIELD_IDS[3],
            "project_id": P_AADI_PRESCHOOL,
            "key": "strength",
            "label": "Student strength",
            "field_type": "number",
            "options": None,
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 4,
        },
        {
            "id": FIELD_IDS[4],
            "project_id": P_AADI_PRESCHOOL,
            "key": "branches",
            "label": "No. of branches",
            "field_type": "number",
            "options": None,
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 5,
        },
        # Paneerwala (Aadi)
        {
            "id": FIELD_IDS[5],
            "project_id": P_AADI_PANEER,
            "key": "product",
            "label": "Product",
            "field_type": "text",
            "options": None,
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 1,
        },
        {
            "id": FIELD_IDS[6],
            "project_id": P_AADI_PANEER,
            "key": "qty",
            "label": "Quantity",
            "field_type": "number",
            "options": None,
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 2,
        },
        {
            "id": FIELD_IDS[7],
            "project_id": P_AADI_PANEER,
            "key": "pay",
            "label": "Payment",
            "field_type": "select",
            "options": ["Pending", "Partial", "Paid"],
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 3,
        },
        # Paneerwala (Spice)
        {
            "id": FIELD_IDS[8],
            "project_id": P_SPICE_PANEER,
            "key": "product",
            "label": "Product",
            "field_type": "text",
            "options": None,
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 1,
        },
        {
            "id": FIELD_IDS[9],
            "project_id": P_SPICE_PANEER,
            "key": "qty",
            "label": "Quantity",
            "field_type": "number",
            "options": None,
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 2,
        },
        {
            "id": FIELD_IDS[10],
            "project_id": P_SPICE_PANEER,
            "key": "pay",
            "label": "Payment",
            "field_type": "select",
            "options": ["Pending", "Partial", "Paid"],
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 3,
        },
        # Hiring
        {
            "id": FIELD_IDS[11],
            "project_id": P_AADI_HIRING,
            "key": "closed",
            "label": "Closed date",
            "field_type": "date",
            "options": None,
            "is_required": False,
            "show_in_list": True,
            "is_active": True,
            "sort_order": 1,
        },
    ]
    op.bulk_insert(lead_fields, [row for row in rows if row["project_id"] in existing])


def downgrade() -> None:
    op.drop_column("leads", "extra_values")
    op.drop_index("ix_lead_fields_project_sort", table_name="lead_fields")
    op.drop_table("lead_fields")
