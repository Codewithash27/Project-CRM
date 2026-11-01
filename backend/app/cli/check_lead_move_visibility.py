"""Find leads owned by a salesperson who is NOT assigned to that lead's project.

This is the defect behind: Move leads succeeds, but Demo still sees 0 leads
("You are not assigned to any project yet").

Run from the backend folder:

    python -m app.cli.check_lead_move_visibility
    python -m app.cli.check_lead_move_visibility --fix

--fix adds missing project_members so the owner can see those leads.
"""

from __future__ import annotations

import argparse
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.database import SessionLocal
from app.leads.models import Lead
from app.organization.models import Project, ProjectMember
from app.roles.models import Role, UserRole
from app.roles.service import RoleName
from app.users.models import User


def _salesperson_ids(db) -> set:
    rows = db.scalars(
        select(User.id)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(Role.name == RoleName.SALESPERSON, User.is_active.is_(True))
    ).all()
    return set(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Assign orphaned lead owners to their lead's project",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        sales_ids = _salesperson_ids(db)
        leads = list(
            db.scalars(
                select(Lead).where(
                    Lead.is_deleted.is_(False),
                    Lead.project_id.is_not(None),
                    Lead.owner_id.in_(sales_ids) if sales_ids else False,
                )
            ).all()
        )
        memberships = {
            (row.project_id, row.user_id)
            for row in db.scalars(select(ProjectMember)).all()
        }

        orphans: list[Lead] = []
        for lead in leads:
            if lead.project_id is None:
                continue
            if (lead.project_id, lead.owner_id) not in memberships:
                orphans.append(lead)

        print(f"Salespeople: {len(sales_ids)}")
        print(f"Active project leads owned by salespeople: {len(leads)}")
        print(f"Orphaned (owner not on project): {len(orphans)}")
        print()

        if not orphans:
            print("OK — no visibility defect found.")
            return 0

        projects = {
            project.id: project
            for project in db.scalars(
                select(Project).where(Project.id.in_({lead.project_id for lead in orphans if lead.project_id}))
            ).all()
        }
        users = {
            user.id: user
            for user in db.scalars(
                select(User).where(User.id.in_({lead.owner_id for lead in orphans}))
            ).all()
        }

        for lead in orphans:
            project = projects.get(lead.project_id) if lead.project_id else None
            owner = users.get(lead.owner_id)
            print(
                f"- {lead.lead_number} | {lead.full_name!r} | "
                f"project={(project.name if project else lead.project_id)} | "
                f"owner={(owner.email if owner else lead.owner_id)}"
            )

        if not args.fix:
            print()
            print("Defect confirmed: ownership moved, but project assignment missing.")
            print("Re-run with --fix to assign these owners to the lead project.")
            return 1

        fixed_pairs: set[tuple] = set()
        now = datetime.now(UTC)
        for lead in orphans:
            if lead.project_id is None:
                continue
            pair = (lead.project_id, lead.owner_id)
            if pair in memberships or pair in fixed_pairs:
                continue
            db.add(
                ProjectMember(
                    project_id=lead.project_id,
                    user_id=lead.owner_id,
                    assigned_by_id=None,
                    created_at=now,
                )
            )
            fixed_pairs.add(pair)
        db.commit()
        print()
        print(f"Fixed: added {len(fixed_pairs)} project membership(s). Demo/Kunal should now see moved leads.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
