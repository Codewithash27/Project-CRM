"""Project list and creation."""

import uuid
from datetime import UTC, datetime

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.leads.models import Lead
from app.organization.models import ACTIVE, Company, ProjectMember
from app.roles.models import UserRole
from app.roles.service import get_role_by_name
from app.users.models import User
from sqlalchemy import select

from tests.helpers import VALID_PASSWORD, csrf_headers, login


def _now() -> datetime:
    return datetime.now(UTC)


def _add_company(name: str, *, status: str = ACTIVE) -> uuid.UUID:
    db = SessionLocal()
    try:
        company = Company(name=name, status=status, created_at=_now(), updated_at=_now())
        db.add(company)
        db.commit()
        return company.id
    finally:
        db.close()


def _add_member(email: str, role_name: str, company_id: uuid.UUID | None = None) -> None:
    db = SessionLocal()
    try:
        role = get_role_by_name(db, role_name)
        assert role is not None
        now = _now()
        user = User(
            email=email,
            password_hash=hash_password(VALID_PASSWORD),
            full_name=email.split("@", 1)[0],
            preferred_language="en",
            is_active=True,
            email_verified=True,
            session_version=1,
            company_id=company_id,
            created_at=now,
            updated_at=now,
        )
        user.user_roles.append(UserRole(role=role, created_at=now))
        db.add(user)
        db.commit()
    finally:
        db.close()


async def test_super_admin_creates_a_project_and_owner_can_see_it(client):
    company_id = _add_company("Little Steps")
    _add_member("platform@example.com", "SUPER_ADMIN")
    _add_member("owner@example.com", "BUSINESS_OWNER", company_id)
    _add_member("rep@example.com", "SALESPERSON", company_id)

    assert (await login(client, email="platform@example.com")).status_code == 200
    created = await client.post(
        "/api/v1/projects",
        json={
            "name": "Preschool",
            "code": "preschool",
            "company_id": str(company_id),
            "template": "PRESCHOOL",
        },
        headers=await csrf_headers(client),
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["message"].startswith("Preschool is created")
    item = next(project for project in body["data"]["items"] if project["code"] == "PRESCHOOL")
    assert item["company_name"] == "Little Steps"
    assert item["next_lead_number"] == "PRESCHOOL-0001"
    assert item["status"] == "active"
    assert body["data"]["can_create"] is True

    duplicate = await client.post(
        "/api/v1/projects",
        json={"name": "Preschool again", "code": "PRESCHOOL", "company_id": str(company_id), "template": "GENERIC"},
        headers=await csrf_headers(client),
    )
    assert duplicate.status_code == 422
    assert duplicate.json()["error"]["details"][0]["field"] == "code"

    assert (await login(client, email="owner@example.com")).status_code == 200
    listed = await client.get("/api/v1/projects")
    assert listed.status_code == 200
    owner_body = listed.json()["data"]
    assert owner_body["can_create"] is False
    assert owner_body["companies"] == []
    assert [project["code"] for project in owner_body["items"]] == ["PRESCHOOL"]

    blocked = await client.post(
        "/api/v1/projects",
        json={"name": "Other", "code": "OTHER", "company_id": str(company_id), "template": "GENERIC"},
        headers=await csrf_headers(client),
    )
    assert blocked.status_code == 403

    assert (await login(client, email="rep@example.com")).status_code == 200
    # Salesperson with no Team assignment sees an empty project list.
    listed_rep = await client.get("/api/v1/projects")
    assert listed_rep.status_code == 200
    assert listed_rep.json()["data"]["items"] == []
    assert listed_rep.json()["data"]["can_create"] is False


async def test_super_admin_edits_a_project_and_owner_cannot(client):
    company_id = _add_company("North Campus")
    _add_member("editor@example.com", "SUPER_ADMIN")
    _add_member("campus-owner@example.com", "BUSINESS_OWNER", company_id)

    assert (await login(client, email="editor@example.com")).status_code == 200
    created = await client.post(
        "/api/v1/projects",
        json={"name": "Admissions", "code": "ADMIT", "company_id": str(company_id), "template": "GENERIC"},
        headers=await csrf_headers(client),
    )
    assert created.status_code == 200, created.text
    project_id = next(item["id"] for item in created.json()["data"]["items"] if item["code"] == "ADMIT")

    updated = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Admissions 2026", "description": "Autumn intake", "status": "inactive"},
        headers=await csrf_headers(client),
    )
    assert updated.status_code == 200, updated.text
    item = next(project for project in updated.json()["data"]["items"] if project["id"] == project_id)
    assert item["name"] == "Admissions 2026"
    assert item["description"] == "Autumn intake"
    assert item["status"] == "inactive"
    assert item["code"] == "ADMIT"
    assert updated.json()["message"] == "Admissions 2026 is updated."

    assert (await login(client, email="campus-owner@example.com")).status_code == 200
    hidden = await client.get("/api/v1/projects")
    assert hidden.status_code == 200
    assert hidden.json()["data"]["items"] == []
    blocked = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Nope", "description": "", "status": "active"},
        headers=await csrf_headers(client),
    )
    assert blocked.status_code == 403

    assert (await login(client, email="editor@example.com")).status_code == 200
    restored = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Admissions 2026", "description": "Autumn intake", "status": "active"},
        headers=await csrf_headers(client),
    )
    assert restored.status_code == 200, restored.text
    assert (await login(client, email="campus-owner@example.com")).status_code == 200
    visible = await client.get("/api/v1/projects")
    assert [project["code"] for project in visible.json()["data"]["items"]] == ["ADMIT"]


async def test_super_admin_deletes_an_empty_project_and_keeps_one_with_leads(client):
    company_id = _add_company("Delete Co")
    _add_member("deleter@example.com", "SUPER_ADMIN")
    _add_member("keep-owner@example.com", "BUSINESS_OWNER", company_id)

    assert (await login(client, email="deleter@example.com")).status_code == 200
    created = await client.post(
        "/api/v1/projects",
        json={"name": "Empty", "code": "EMPTY", "company_id": str(company_id), "template": "GENERIC"},
        headers=await csrf_headers(client),
    )
    assert created.status_code == 200, created.text
    project_id = next(item["id"] for item in created.json()["data"]["items"] if item["code"] == "EMPTY")

    assert (await login(client, email="keep-owner@example.com")).status_code == 200
    blocked = await client.delete(f"/api/v1/projects/{project_id}", headers=await csrf_headers(client))
    assert blocked.status_code == 403

    assert (await login(client, email="deleter@example.com")).status_code == 200
    deleted = await client.delete(f"/api/v1/projects/{project_id}", headers=await csrf_headers(client))
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["message"] == "Empty is deleted."
    assert all(item["id"] != project_id for item in deleted.json()["data"]["items"])

    again = await client.post(
        "/api/v1/projects",
        json={"name": "With leads", "code": "KEEP", "company_id": str(company_id), "template": "GENERIC"},
        headers=await csrf_headers(client),
    )
    kept_id = next(item["id"] for item in again.json()["data"]["items"] if item["code"] == "KEEP")
    db = SessionLocal()
    try:
        now = _now()
        owner = db.scalar(select(User).where(User.email == "keep-owner@example.com"))
        assert owner is not None
        db.add(
            Lead(
                company_id=company_id,
                project_id=uuid.UUID(kept_id),
                lead_number="KEEP-0001",
                full_name="Kept Lead",
                mobile="9000000099",
                owner_id=owner.id,
                created_by_id=owner.id,
                status="new",
                priority="medium",
                plan_step="Day 1",
                is_deleted=False,
                created_at=now,
                updated_at=now,
            )
        )
        db.commit()
    finally:
        db.close()

    refused = await client.delete(f"/api/v1/projects/{kept_id}", headers=await csrf_headers(client))
    assert refused.status_code == 409


async def test_super_admin_moves_a_project_and_its_leads_to_another_business(client):
    source_id = _add_company("Source Biz")
    destination_id = _add_company("Destination Biz")
    _add_member("move-admin@example.com", "SUPER_ADMIN")
    _add_member("source-owner@example.com", "BUSINESS_OWNER", source_id)
    _add_member("dest-owner@example.com", "BUSINESS_OWNER", destination_id)
    _add_member("move-rep@example.com", "SALESPERSON", source_id)

    assert (await login(client, email="move-admin@example.com")).status_code == 200
    created = await client.post(
        "/api/v1/projects",
        json={"name": "Hiring", "code": "HIRE", "company_id": str(source_id), "template": "GENERIC"},
        headers=await csrf_headers(client),
    )
    assert created.status_code == 200, created.text
    project_id = next(item["id"] for item in created.json()["data"]["items"] if item["code"] == "HIRE")

    db = SessionLocal()
    try:
        now = _now()
        rep = db.scalar(select(User).where(User.email == "move-rep@example.com"))
        owner = db.scalar(select(User).where(User.email == "source-owner@example.com"))
        assert rep is not None and owner is not None
        db.add(
            ProjectMember(project_id=uuid.UUID(project_id), user_id=rep.id, assigned_by_id=owner.id, created_at=now)
        )
        db.add(
            Lead(
                company_id=source_id,
                project_id=uuid.UUID(project_id),
                lead_number="HIRE-0001",
                full_name="Moved Lead",
                mobile="9000000101",
                owner_id=rep.id,
                created_by_id=owner.id,
                status="new",
                priority="medium",
                plan_step="Day 1",
                is_deleted=False,
                created_at=now,
                updated_at=now,
            )
        )
        db.commit()
        rep_id = rep.id
        dest_owner_id = db.scalar(select(User.id).where(User.email == "dest-owner@example.com"))
    finally:
        db.close()

    moved = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={
            "name": "Hiring",
            "description": "Moved",
            "status": "active",
            "company_id": str(destination_id),
        },
        headers=await csrf_headers(client),
    )
    assert moved.status_code == 200, moved.text
    item = next(project for project in moved.json()["data"]["items"] if project["id"] == project_id)
    assert item["company_id"] == str(destination_id)
    assert item["company_name"] == "Destination Biz"
    assert item["lead_count"] == 1
    assert item["code"] == "HIRE"

    db = SessionLocal()
    try:
        lead = db.scalar(select(Lead).where(Lead.lead_number == "HIRE-0001"))
        assert lead is not None
        assert lead.company_id == destination_id
        assert lead.owner_id == rep_id
        assert lead.is_deleted is False
        members = set(
            db.scalars(select(ProjectMember.user_id).where(ProjectMember.project_id == uuid.UUID(project_id))).all()
        )
        assert rep_id in members
        assert dest_owner_id in members
    finally:
        db.close()

    blocked = await client.post(
        "/api/v1/projects",
        json={"name": "Other hire", "code": "HIRE", "company_id": str(source_id), "template": "GENERIC"},
        headers=await csrf_headers(client),
    )
    assert blocked.status_code == 200, blocked.text
    clash_id = next(item["id"] for item in blocked.json()["data"]["items"] if item["name"] == "Other hire")
    refused = await client.patch(
        f"/api/v1/projects/{clash_id}",
        json={"name": "Other hire", "description": "", "status": "active", "company_id": str(destination_id)},
        headers=await csrf_headers(client),
    )
    assert refused.status_code == 422
    assert refused.json()["error"]["details"][0]["field"] == "company_id"
    listed = await client.get("/api/v1/projects")
    clash = next(project for project in listed.json()["data"]["items"] if project["id"] == clash_id)
    assert clash["company_id"] == str(source_id)


async def test_project_move_stops_when_the_lead_number_already_exists(client):
    source_id = _add_company("Number Source")
    destination_id = _add_company("Number Dest")
    _add_member("number-admin@example.com", "SUPER_ADMIN")
    _add_member("number-owner@example.com", "BUSINESS_OWNER", source_id)
    _add_member("number-dest-owner@example.com", "BUSINESS_OWNER", destination_id)

    assert (await login(client, email="number-admin@example.com")).status_code == 200
    source = await client.post(
        "/api/v1/projects",
        json={"name": "Alpha", "code": "ALPHA", "company_id": str(source_id), "template": "GENERIC"},
        headers=await csrf_headers(client),
    )
    dest = await client.post(
        "/api/v1/projects",
        json={"name": "Beta", "code": "BETA", "company_id": str(destination_id), "template": "GENERIC"},
        headers=await csrf_headers(client),
    )
    source_project = next(item["id"] for item in source.json()["data"]["items"] if item["code"] == "ALPHA")
    dest_project = next(item["id"] for item in dest.json()["data"]["items"] if item["code"] == "BETA")

    db = SessionLocal()
    try:
        now = _now()
        owner = db.scalar(select(User).where(User.email == "number-owner@example.com"))
        dest_owner = db.scalar(select(User).where(User.email == "number-dest-owner@example.com"))
        assert owner is not None and dest_owner is not None
        db.add(
            Lead(
                company_id=source_id,
                project_id=uuid.UUID(source_project),
                lead_number="ALPHA-0001",
                full_name="Source Lead",
                mobile="9000000102",
                owner_id=owner.id,
                created_by_id=owner.id,
                status="new",
                priority="medium",
                plan_step="Day 1",
                is_deleted=False,
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            Lead(
                company_id=destination_id,
                project_id=uuid.UUID(dest_project),
                lead_number="ALPHA-0001",
                full_name="Already There",
                mobile="9000000103",
                owner_id=dest_owner.id,
                created_by_id=dest_owner.id,
                status="new",
                priority="medium",
                plan_step="Day 1",
                is_deleted=False,
                created_at=now,
                updated_at=now,
            )
        )
        db.commit()
    finally:
        db.close()

    refused = await client.patch(
        f"/api/v1/projects/{source_project}",
        json={"name": "Alpha", "description": "", "status": "active", "company_id": str(destination_id)},
        headers=await csrf_headers(client),
    )
    assert refused.status_code == 422
    assert "Nothing was changed" in refused.json()["error"]["message"]

    db = SessionLocal()
    try:
        lead = db.scalar(select(Lead).where(Lead.full_name == "Source Lead"))
        assert lead is not None
        assert lead.company_id == source_id
    finally:
        db.close()
