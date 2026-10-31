"""Business create, edit, and delete for Super Admin."""

import uuid
from datetime import UTC, datetime

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.organization.models import ACTIVE, Company
from app.roles.models import UserRole
from app.roles.service import get_role_by_name
from app.users.models import User

from tests.helpers import VALID_PASSWORD, csrf_headers, login


def _now() -> datetime:
    return datetime.now(UTC)


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


async def test_super_admin_creates_edits_and_deletes_empty_business(client):
    _add_member("platform@example.com", "SUPER_ADMIN")
    assert (await login(client, email="platform@example.com")).status_code == 200

    created = await client.post(
        "/api/v1/businesses",
        json={
            "name": "Northwind Labs",
            "plan_label": "Pro",
            "status": "active",
            "industry": "Technology",
            "website": "northwind.example",
            "email": "hello@northwind.example",
            "phone": "+91 98765 43210",
            "city": "Pune",
            "address": "Baner Road",
            "gst_number": "27AABCU9603R1ZM",
            "remarks": "Warm account — ask for Arjun",
        },
        headers=await csrf_headers(client),
    )
    assert created.status_code == 200, created.text
    body = created.json()["data"]
    assert body["name"] == "Northwind Labs"
    assert body["plan_label"] == "Pro"
    assert body["industry"] == "Technology"
    assert body["email"] == "hello@northwind.example"
    assert body["city"] == "Pune"
    assert body["website"] == "https://northwind.example"
    assert body["can_delete"] is True
    company_id = body["id"]

    updated = await client.patch(
        f"/api/v1/businesses/{company_id}",
        json={
            "name": "Northwind Labs Pvt",
            "plan_label": "Enterprise",
            "status": "inactive",
            "industry": "Services",
            "website": "https://northwind.example",
            "email": "ops@northwind.example",
            "phone": "+91 98765 43210",
            "city": "Mumbai",
            "address": "Andheri East",
            "gst_number": "27AABCU9603R1ZM",
            "remarks": "Moved HQ",
        },
        headers=await csrf_headers(client),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["data"]["name"] == "Northwind Labs Pvt"
    assert updated.json()["data"]["status"] == "inactive"
    assert updated.json()["data"]["plan_label"] == "Enterprise"
    assert updated.json()["data"]["city"] == "Mumbai"

    listed = await client.get("/api/v1/businesses")
    assert listed.status_code == 200
    names = [item["name"] for item in listed.json()["data"]["items"]]
    assert "Northwind Labs Pvt" in names

    deleted = await client.delete(
        f"/api/v1/businesses/{company_id}",
        headers=await csrf_headers(client),
    )
    assert deleted.status_code == 200, deleted.text
    after = await client.get("/api/v1/businesses")
    assert "Northwind Labs Pvt" not in [item["name"] for item in after.json()["data"]["items"]]


async def test_business_owner_cannot_manage_businesses(client):
    db = SessionLocal()
    try:
        company = Company(name="Owner Co", status=ACTIVE, created_at=_now(), updated_at=_now())
        db.add(company)
        db.commit()
        company_id = company.id
    finally:
        db.close()
    _add_member("owner@example.com", "BUSINESS_OWNER", company_id)
    assert (await login(client, email="owner@example.com")).status_code == 200
    response = await client.get("/api/v1/businesses")
    assert response.status_code == 403


async def test_cannot_delete_business_with_users(client):
    db = SessionLocal()
    try:
        company = Company(name="Busy Co", status=ACTIVE, created_at=_now(), updated_at=_now())
        db.add(company)
        db.commit()
        company_id = company.id
    finally:
        db.close()
    _add_member("platform2@example.com", "SUPER_ADMIN")
    _add_member("staff@example.com", "SALESPERSON", company_id)
    assert (await login(client, email="platform2@example.com")).status_code == 200
    response = await client.delete(
        f"/api/v1/businesses/{company_id}",
        headers=await csrf_headers(client),
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


async def test_duplicate_business_name_is_rejected(client):
    _add_member("platform3@example.com", "SUPER_ADMIN")
    assert (await login(client, email="platform3@example.com")).status_code == 200
    first = await client.post(
        "/api/v1/businesses",
        json={"name": "Same Name Co", "plan_label": "Free", "status": "active"},
        headers=await csrf_headers(client),
    )
    assert first.status_code == 200
    second = await client.post(
        "/api/v1/businesses",
        json={"name": "same name co", "plan_label": "Free", "status": "active"},
        headers=await csrf_headers(client),
    )
    assert second.status_code == 422
    assert second.json()["error"]["details"][0]["code"] == "DUPLICATE_NAME"
