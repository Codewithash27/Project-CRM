"""Create / reset the college demo admin and print login details.

Run from the backend folder after: alembic upgrade head

    python -m app.cli.seed_demo

Migrations already insert sample companies, users, projects, and leads.
This script makes sure a Super Admin exists with a known password, then
prints row counts and login emails.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select, text

from app.common.exceptions import AppError
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.leads.models import Lead
from app.organization.models import Company, Project
from app.roles.models import Role, UserRole
from app.roles.service import RoleName
from app.users.models import User
from app.users.service import create_initial_admin

ADMIN_EMAIL = "admin@example.com"
ADMIN_NAME = "College Admin"
ADMIN_PASSWORD = "CollegeDemo#1"

# Same password for every demo user inserted by migration 0004.
DEMO_PASSWORD = "AadiDemo#2026"


def _ensure_admin(db) -> None:
    existing = db.scalar(select(User).where(User.email == ADMIN_EMAIL))
    if existing is not None:
        existing.password_hash = hash_password(ADMIN_PASSWORD)
        existing.is_active = True
        existing.email_verified = True
        existing.updated_at = datetime.now(UTC)
        db.commit()
        print(f"Reset Super Admin password: {ADMIN_EMAIL}")
        return

    try:
        create_initial_admin(
            db,
            email=ADMIN_EMAIL,
            full_name=ADMIN_NAME,
            password=ADMIN_PASSWORD,
            preferred_language="en",
        )
        print(f"Created Super Admin: {ADMIN_EMAIL}")
        return
    except AppError as exc:
        # Another Super Admin already exists — attach this account as SUPER_ADMIN too.
        if "administrator already" not in exc.message.lower():
            print(f"Admin note: {exc.message}")
            return

    role = db.scalar(select(Role).where(Role.name == RoleName.SUPER_ADMIN))
    if role is None:
        print("Admin note: SUPER_ADMIN role is missing. Run alembic upgrade head.")
        return

    now = datetime.now(UTC)
    user = User(
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        full_name=ADMIN_NAME,
        preferred_language="en",
        is_active=True,
        email_verified=True,
        session_version=1,
        created_at=now,
        updated_at=now,
    )
    user.user_roles.append(UserRole(role=role, created_at=now))
    db.add(user)
    db.commit()
    print(f"Created extra Super Admin for college: {ADMIN_EMAIL}")


def main() -> int:
    db = SessionLocal()
    try:
        _ensure_admin(db)

        companies = db.scalar(select(func.count()).select_from(Company)) or 0
        users = db.scalar(select(func.count()).select_from(User)) or 0
        projects = db.scalar(select(func.count()).select_from(Project)) or 0
        leads = db.scalar(select(func.count()).select_from(Lead).where(Lead.is_deleted.is_(False))) or 0

        print()
        print("=== Database counts ===")
        print(f"  companies : {companies}")
        print(f"  users     : {users}")
        print(f"  projects  : {projects}")
        print(f"  leads     : {leads}")

        if companies == 0:
            print()
            print("No demo companies found. Run this first, then seed again:")
            print("  python -m alembic upgrade head")
            return 1

        print()
        print("=== Login (open http://localhost:5173) ===")
        print(f"  Super Admin     {ADMIN_EMAIL:<24} /  {ADMIN_PASSWORD}")
        print(f"  Business Owner  {'arjun@aadi-demo.test':<24} /  {DEMO_PASSWORD}")
        print(f"  Salesperson     {'riya@aadi-demo.test':<24} /  {DEMO_PASSWORD}")
        print(f"  Salesperson     {'kunal@aadi-demo.test':<24} /  {DEMO_PASSWORD}")
        print()
        print("API docs: http://localhost:8000/api/docs")

        rows = db.execute(
            text(
                "SELECT lead_number, full_name, status, priority "
                "FROM leads WHERE is_deleted = false "
                "ORDER BY created_at LIMIT 5"
            )
        ).all()
        if rows:
            print()
            print("=== Sample leads (first 5) ===")
            for number, name, status, priority in rows:
                print(f"  {number:16}  {name:22}  {status:12}  {priority}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
