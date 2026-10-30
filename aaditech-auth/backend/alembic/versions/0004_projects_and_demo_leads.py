"""Projects, assignments, and the demo lead sheet.

Revision ID: 0004_projects_and_demo_leads
Revises: 0003_leads
Create Date: 2026-10-30

Seeded demo users share the password AadiDemo#2026. Plans are stored as a
label only. Limits are not enforced. Neha Kulkarni is on the source sheet as
Project Manager and is not created: the Business Owner assigns projects.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_projects_and_demo_leads"
down_revision = "0003_leads"
branch_labels = None
depends_on = None

ROLE_BUSINESS_OWNER = "b0000000-0000-4000-8000-000000000002"
ROLE_SALESPERSON = "b0000000-0000-4000-8000-000000000003"
DEMO_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=1$5v9D5O/+St73LWIaBB6Lsw$WZX5EXkIgfZo6ngklQID7djK+oUV77+gzi+NHCCeTZU"
)

AADI = "11111111-1111-4111-8111-111111111111"
SPICE = "22222222-2222-4222-8222-222222222222"
ARJUN = "33333333-3333-4333-8333-333333333301"
RIYA = "33333333-3333-4333-8333-333333333302"
KUNAL = "33333333-3333-4333-8333-333333333303"
ANJALI = "33333333-3333-4333-8333-333333333304"
FARAH = "33333333-3333-4333-8333-333333333305"
IMRAN = "33333333-3333-4333-8333-333333333306"
P_AADI_PANEER = "44444444-4444-4444-8444-444444444401"
P_AADI_HIRING = "44444444-4444-4444-8444-444444444402"
P_AADI_PRESCHOOL = "44444444-4444-4444-8444-444444444403"
P_AADI_SPACE = "44444444-4444-4444-8444-444444444404"
P_SPICE_PANEER = "44444444-4444-4444-8444-444444444405"

COMPANY_IDS = (AADI, SPICE)
USER_IDS = (ARJUN, RIYA, KUNAL, ANJALI, FARAH, IMRAN)
PROJECT_IDS = (P_AADI_PANEER, P_AADI_HIRING, P_AADI_PRESCHOOL, P_AADI_SPACE, P_SPICE_PANEER)


def upgrade() -> None:
    op.add_column("companies", sa.Column("plan_label", sa.String(length=20), nullable=True))
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("template", sa.String(length=40), nullable=False),
        sa.Column("description", sa.String(length=500), server_default=sa.text("''"), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('active', 'inactive')", name="ck_projects_status"),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            ondelete="RESTRICT",
            name="fk_projects_company_id",
        ),
        sa.UniqueConstraint("company_id", "code", name="uq_projects_company_code"),
    )
    op.create_index("ix_projects_company_id", "projects", ["company_id"])
    op.create_table(
        "project_members",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
            name="fk_project_members_project_id",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="fk_project_members_user_id",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_by_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_project_members_assigned_by_id",
        ),
        sa.PrimaryKeyConstraint("project_id", "user_id", name="pk_project_members"),
    )
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"])

    op.drop_constraint("ck_leads_status", "leads", type_="check")
    op.drop_constraint("ck_leads_priority", "leads", type_="check")
    op.drop_constraint("uq_leads_lead_number", "leads", type_="unique")
    op.add_column("leads", sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("leads", sa.Column("enquiry_date", sa.Date(), nullable=True))
    op.add_column("leads", sa.Column("location", sa.String(length=100), nullable=True))
    op.add_column("leads", sa.Column("reference_name", sa.String(length=120), nullable=True))
    op.add_column("leads", sa.Column("call_summary", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("recruitment_stage", sa.String(length=80), nullable=True))
    op.add_column("leads", sa.Column("recruitment_outcome", sa.String(length=80), nullable=True))
    op.add_column("leads", sa.Column("site", sa.String(length=200), nullable=True))
    op.add_column("leads", sa.Column("order_amount", sa.Numeric(precision=15, scale=2), nullable=True))
    op.create_foreign_key(
        "fk_leads_project_id",
        "leads",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_leads_project_id", "leads", ["project_id"])
    op.create_unique_constraint("uq_leads_company_lead_number", "leads", ["company_id", "lead_number"])
    op.create_check_constraint(
        "ck_leads_status",
        "leads",
        "status IN ('new', 'contacted', 'qualified', 'unqualified', 'lost', "
        "'New', 'Contacted', 'In Progress', 'Qualified', 'Won', 'Lost', 'Nurture')",
    )
    op.create_check_constraint(
        "ck_leads_priority",
        "leads",
        "priority IN ('low', 'medium', 'high', 'Hot', 'Warm', 'Cold')",
    )
    op.create_check_constraint(
        "ck_leads_order_amount",
        "leads",
        "order_amount IS NULL OR order_amount >= 0",
    )
    _seed()


def _seed() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "INSERT INTO companies (id, name, status, plan_label) VALUES "
            "(:id, :name, 'active', :plan_label)"
        ),
        [
            {"id": AADI, "name": "Aadi CRM Development", "plan_label": "Pro"},
            {"id": SPICE, "name": "Spice Route Foods", "plan_label": "Free"},
        ],
    )
    users = [
        (ARJUN, AADI, "Arjun Mehta", "arjun@aadi-demo.test"),
        (RIYA, AADI, "Riya Kulkarni", "riya@aadi-demo.test"),
        (KUNAL, AADI, "Kunal Deshmukh", "kunal@aadi-demo.test"),
        (ANJALI, AADI, "Anjali Pawar", "anjali@aadi-demo.test"),
        (FARAH, SPICE, "Farah Khan", "farah@spice-demo.test"),
        (IMRAN, SPICE, "Imran Sheikh", "imran@spice-demo.test"),
    ]
    bind.execute(
        sa.text(
            "INSERT INTO users (id, email, password_hash, full_name, company_id, email_verified) "
            "VALUES (:id, :email, :password_hash, :full_name, :company_id, true)"
        ),
        [
            {
                "id": user_id,
                "email": email,
                "password_hash": DEMO_PASSWORD_HASH,
                "full_name": name,
                "company_id": company_id,
            }
            for user_id, company_id, name, email in users
        ],
    )
    bind.execute(
        sa.text("INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)"),
        [{"user_id": ARJUN, "role_id": ROLE_BUSINESS_OWNER}, {"user_id": FARAH, "role_id": ROLE_BUSINESS_OWNER}]
        + [
            {"user_id": user_id, "role_id": ROLE_SALESPERSON}
            for user_id in (RIYA, KUNAL, ANJALI, IMRAN)
        ],
    )
    bind.execute(
        sa.text(
            "INSERT INTO projects (id, company_id, name, code, template, description) "
            "VALUES (:id, :company_id, :name, :code, :template, :description)"
        ),
        [
            {
                "id": P_AADI_PANEER,
                "company_id": AADI,
                "name": "Paneerwala",
                "code": "PANEERWALA",
                "template": "PANEERWALA",
                "description": "Paneer orders. Expected Value is the opportunity; Order Amount is the actual order.",
            },
            {
                "id": P_AADI_HIRING,
                "company_id": AADI,
                "name": "Hiring",
                "code": "HIRING",
                "template": "HIRING",
                "description": "Candidates. Recruitment Stage and Recruitment Outcome are tracked.",
            },
            {
                "id": P_AADI_PRESCHOOL,
                "company_id": AADI,
                "name": "Preschool",
                "code": "PRESCHOOL",
                "template": "PRESCHOOL",
                "description": "Admission enquiries. Expected Value is the opportunity amount.",
            },
            {
                "id": P_AADI_SPACE,
                "company_id": AADI,
                "name": "Space View",
                "code": "SPACE-VIEW",
                "template": "SPACE-VIEW",
                "description": "Interior and space planning. Site is required.",
            },
            {
                "id": P_SPICE_PANEER,
                "company_id": SPICE,
                "name": "Paneerwala",
                "code": "PANEERWALA",
                "template": "PANEERWALA",
                "description": "Restaurant and caterer paneer supply.",
            },
        ],
    )
    assignments = [
        (P_AADI_PANEER, RIYA),
        (P_AADI_HIRING, RIYA),
        (P_AADI_PRESCHOOL, RIYA),
        (P_AADI_SPACE, RIYA),
        (P_AADI_PANEER, KUNAL),
        (P_AADI_HIRING, KUNAL),
        (P_AADI_PRESCHOOL, KUNAL),
        (P_AADI_SPACE, KUNAL),
        (P_AADI_PRESCHOOL, ANJALI),
        (P_AADI_SPACE, ANJALI),
        (P_SPICE_PANEER, IMRAN),
    ]
    bind.execute(
        sa.text(
            "INSERT INTO project_members (project_id, user_id, assigned_by_id) "
            "VALUES (:project_id, :user_id, :assigned_by_id)"
        ),
        [
            {
                "project_id": project_id,
                "user_id": user_id,
                "assigned_by_id": ARJUN if project_id != P_SPICE_PANEER else FARAH,
            }
            for project_id, user_id in assignments
        ],
    )

    # id, project, owner, number, enquiry, name, mobile, location, email, requirement,
    # reference, source, priority, call, follow-up, status, stage, outcome, site, expected, order
    rows = [
        ("01", P_AADI_PANEER, RIYA, "PANEERWALA-0001", "2026-10-24", "Sandeep Joshi", "9822011101", "Kothrud", "sandeep@example.in", "Bulk paneer order for 200 guests", "Mahesh Kulkarni", "Referral", "Hot", "Wants quote by Friday", "2026-10-28", "In Progress", None, None, None, 45000, None),
        ("02", P_AADI_PANEER, RIYA, "PANEERWALA-0002", "2026-09-30", "Neha Phadke", "9822011102", "Baner", "neha@example.in", "Weekly paneer supply for cafe", None, "WhatsApp", "Warm", "Order delivered", None, "Won", None, None, None, 60000, 52500),
        ("03", P_AADI_PANEER, RIYA, "PANEERWALA-0003", "2026-10-29", "Prakash Shinde", "9822022201", "Kothrud", "prakash@example.in", "Paneer for wedding", None, "WhatsApp", "Hot", None, "2026-10-30", "New", None, None, None, 30000, None),
        ("04", P_AADI_PANEER, KUNAL, "PANEERWALA-0004", "2026-10-26", "Sunita Bhosale", "9822022205", "Wakad", "sunita@example.in", "Monthly supply for tiffin service", None, "Instagram", "Warm", "Asked for sample pack", "2026-11-01", "Contacted", None, None, None, 36000, None),
        ("05", P_AADI_PANEER, RIYA, "PANEERWALA-0005", "2026-10-05", "Hotel Sai Residency", "9822011111", "Hadapsar", "hotel@example.in", "Restaurant supply, 30 kg a week", None, "Justdial", "Cold", "Went with existing vendor (lost: Price)", None, "Lost", None, None, None, 90000, None),
        ("06", P_AADI_HIRING, RIYA, "HIRING-0001", "2026-10-18", "Aniket Pawar", "9822011103", "Wakad", "aniket@example.in", "Frontend developer, 3 years", None, "Website", "Warm", "Shared portfolio", "2026-10-27", "In Progress", "Technical round", None, None, None, None),
        ("07", P_AADI_HIRING, RIYA, "HIRING-0002", "2026-09-20", "Pooja Nair", "9822011104", "Hadapsar", "pooja@example.in", "Backend developer", None, "Referral", "Hot", "Accepted offer", None, "Won", "Hired", "Hired", None, None, None),
        ("08", P_AADI_HIRING, KUNAL, "HIRING-0003", "2026-10-25", "Isha Kulkarni", "9822022202", "Baner", "isha@example.in", "UI designer", None, "Instagram", "Warm", "Sent assignment", "2026-11-01", "Contacted", "Applied", None, None, None, None),
        ("09", P_AADI_PRESCHOOL, RIYA, "PRESCHOOL-0001", "2026-10-29", "Meghna Deshpande", "9822011106", "Baner", "meghna@example.in", "Admission for age 3, July batch", None, "Walk-in", "Hot", None, "2026-10-30", "New", None, None, None, 120000, None),
        ("10", P_AADI_PRESCHOOL, ANJALI, "PRESCHOOL-0002", "2026-10-29", "Sneha Kulkarni", "9822044401", "Baner", "sneha@example.in", "Admission for age 2.5, next batch", None, "Walk-in", "Hot", None, "2026-10-30", "New", None, None, None, 70000, None),
        ("11", P_AADI_PRESCHOOL, ANJALI, "PRESCHOOL-0003", "2026-10-24", "Amit Deshmukh", "9822044402", "Kothrud", "amit@example.in", "Daycare plus preschool enquiry", None, "Referral", "Warm", "Visiting campus on Saturday", "2026-10-31", "Contacted", None, None, None, 95000, None),
        ("12", P_AADI_PRESCHOOL, RIYA, "PRESCHOOL-0004", "2026-09-10", "Vikram Rao", "9822011107", "Wakad", "vikram@example.in", "Franchise enquiry", None, "Instagram", "Warm", "Revisit after summer", "2026-12-29", "Nurture", None, None, None, 90000, None),
        ("13", P_AADI_SPACE, RIYA, "SPACE-VIEW-0001", "2026-10-09", "Dr. Anita Kale", "9822011108", "Baner", "dr@example.in", "Clinic layout, 900 sq ft", None, "Referral", "Hot", "Sent first layout", "2026-10-30", "Qualified", None, None, "Clinic, Baner", 350000, None),
        ("14", P_AADI_SPACE, ANJALI, "SPACE-VIEW-0002", "2026-10-21", "Dr. Rekha Joshi", "9822044403", "Wakad", "dr@example.in", "Dental clinic layout, 700 sq ft", None, "Website", "Hot", "Sent two layout options", "2026-10-29", "In Progress", None, None, "Clinic, Wakad", 380000, None),
        ("15", P_AADI_SPACE, KUNAL, "SPACE-VIEW-0003", "2026-10-16", "Dhruv Malhotra", "9822022204", "Kothrud", "dhruv@example.in", "Office space plan", None, "Referral", "Hot", "Needs 20 seats", "2026-11-03", "Qualified", None, None, "Office, Kothrud", 700000, None),
        ("16", P_SPICE_PANEER, IMRAN, "PANEERWALA-0001", "2026-10-26", "Meena Iyer", "9811033301", "Bandra", "meena@example.in", "Restaurant paneer supply", None, "Walk-in", "Hot", "Asked for sample", "2026-10-29", "In Progress", None, None, None, 80000, None),
        ("17", P_SPICE_PANEER, IMRAN, "PANEERWALA-0002", "2026-10-29", "Ritesh Jain", "9811033302", "Andheri", "ritesh@example.in", "Caterer, weekly supply", None, "WhatsApp", "Warm", None, "2026-10-30", "New", None, None, None, 55000, None),
    ]
    company_for = {P_SPICE_PANEER: SPICE}
    bind.execute(
        sa.text(
            """
            INSERT INTO leads (
                id, company_id, project_id, lead_number, full_name, mobile, email, city, location,
                requirement, reference_name, lead_source, owner_id, created_by_id, status, priority,
                enquiry_date, call_summary, recruitment_stage, recruitment_outcome, site,
                expected_value, order_amount, next_followup_at
            ) VALUES (
                :id, :company_id, :project_id, :lead_number, :full_name, :mobile, :email, :city, :location,
                :requirement, :reference_name, :lead_source, :owner_id, :owner_id, :status, :priority,
                :enquiry_date, :call_summary, :recruitment_stage, :recruitment_outcome, :site,
                :expected_value, :order_amount, :next_followup_at
            )
            """
        ),
        [
            {
                "id": f"55555555-5555-4555-8555-5555555555{suffix}",
                "company_id": company_for.get(project_id, AADI),
                "project_id": project_id,
                "lead_number": number,
                "full_name": name,
                "mobile": mobile,
                "email": email,
                "city": location,
                "location": location,
                "requirement": requirement,
                "reference_name": reference,
                "lead_source": source,
                "owner_id": owner_id,
                "status": status,
                "priority": priority,
                "enquiry_date": enquiry,
                "call_summary": call,
                "recruitment_stage": stage,
                "recruitment_outcome": outcome,
                "site": site,
                "expected_value": expected,
                "order_amount": order_amount,
                "next_followup_at": None if follow_up is None else f"{follow_up} 10:00:00+00",
            }
            for (
                suffix,
                project_id,
                owner_id,
                number,
                enquiry,
                name,
                mobile,
                location,
                email,
                requirement,
                reference,
                source,
                priority,
                call,
                follow_up,
                status,
                stage,
                outcome,
                site,
                expected,
                order_amount,
            ) in rows
        ],
    )


def downgrade() -> None:
    lead_ids = ", ".join(f"'55555555-5555-4555-8555-5555555555{n:02d}'" for n in range(1, 18))
    user_ids = ", ".join(f"'{user_id}'" for user_id in USER_IDS)
    project_ids = ", ".join(f"'{project_id}'" for project_id in PROJECT_IDS)
    company_ids = ", ".join(f"'{company_id}'" for company_id in COMPANY_IDS)
    op.execute(f"DELETE FROM leads WHERE id IN ({lead_ids})")
    op.execute(f"DELETE FROM project_members WHERE project_id IN ({project_ids})")
    op.execute(f"DELETE FROM projects WHERE id IN ({project_ids})")
    op.execute(f"DELETE FROM user_roles WHERE user_id IN ({user_ids})")
    op.execute(f"DELETE FROM users WHERE id IN ({user_ids})")
    op.execute(f"DELETE FROM companies WHERE id IN ({company_ids})")

    op.drop_constraint("ck_leads_order_amount", "leads", type_="check")
    op.drop_constraint("ck_leads_priority", "leads", type_="check")
    op.drop_constraint("ck_leads_status", "leads", type_="check")
    op.drop_constraint("uq_leads_company_lead_number", "leads", type_="unique")
    op.drop_index("ix_leads_project_id", table_name="leads")
    op.drop_constraint("fk_leads_project_id", "leads", type_="foreignkey")
    op.drop_column("leads", "order_amount")
    op.drop_column("leads", "site")
    op.drop_column("leads", "recruitment_outcome")
    op.drop_column("leads", "recruitment_stage")
    op.drop_column("leads", "call_summary")
    op.drop_column("leads", "reference_name")
    op.drop_column("leads", "location")
    op.drop_column("leads", "enquiry_date")
    op.drop_column("leads", "project_id")
    op.create_unique_constraint("uq_leads_lead_number", "leads", ["lead_number"])
    op.create_check_constraint(
        "ck_leads_status",
        "leads",
        "status IN ('new', 'contacted', 'qualified', 'unqualified', 'lost')",
    )
    op.create_check_constraint(
        "ck_leads_priority",
        "leads",
        "priority IN ('low', 'medium', 'high')",
    )
    op.drop_index("ix_project_members_user_id", table_name="project_members")
    op.drop_table("project_members")
    op.drop_index("ix_projects_company_id", table_name="projects")
    op.drop_table("projects")
    op.drop_column("companies", "plan_label")
