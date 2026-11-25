"""Company WhatsApp templates and the salesperson mobile number used as a signature."""

import base64
import uuid
from datetime import UTC, datetime

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.organization.models import ACTIVE, Company
from app.roles.models import UserRole
from app.roles.service import get_role_by_name
from app.users.models import User

from tests.helpers import VALID_PASSWORD, csrf_headers, login

TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _now() -> datetime:
    return datetime.now(UTC)


def _add_company(name: str) -> uuid.UUID:
    db = SessionLocal()
    try:
        company = Company(name=name, status=ACTIVE, created_at=_now(), updated_at=_now())
        db.add(company)
        db.commit()
        return company.id
    finally:
        db.close()


def _add_member(
    email: str,
    role_name: str,
    company_id: uuid.UUID | None = None,
    mobile: str | None = None,
) -> uuid.UUID:
    db = SessionLocal()
    try:
        role = get_role_by_name(db, role_name)
        assert role is not None
        now = _now()
        user = User(
            email=email,
            password_hash=hash_password(VALID_PASSWORD),
            full_name=email.split("@", 1)[0].replace(".", " ").title(),
            mobile=mobile,
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
        return user.id
    finally:
        db.close()


async def test_owner_and_salesperson_share_templates_and_signature_stays_off_the_saved_message(client):
    company_id = _add_company("Template Co")
    _add_member("owner.templates@example.com", "BUSINESS_OWNER", company_id, mobile="9876543210")
    _add_member("rep.templates@example.com", "SALESPERSON", company_id, mobile="9123456789")
    other_id = _add_company("Other Co")
    _add_member("other.templates@example.com", "SALESPERSON", other_id, mobile="9000000000")

    assert (await login(client, email="owner.templates@example.com")).status_code == 200
    created = await client.post(
        "/api/v1/message-templates",
        data={"title": "Price list", "message": "Hi {name}, here is the price list."},
        files={"image": ("photo.png", TINY_PNG, "image/png")},
        headers=await csrf_headers(client),
    )
    assert created.status_code == 200, created.text
    body = created.json()["data"]
    assert body["title"] == "Price list"
    assert body["message"] == "Hi {name}, here is the price list."
    assert "9876543210" not in body["message"]
    assert body["has_image"] is True
    template_id = body["id"]

    image = await client.get(f"/api/v1/message-templates/{template_id}/image")
    assert image.status_code == 200
    assert image.content == TINY_PNG

    listed = await client.get("/api/v1/message-templates")
    assert listed.status_code == 200
    assert any(item["id"] == template_id for item in listed.json()["data"]["items"])

    assert (await login(client, email="rep.templates@example.com")).status_code == 200
    seen = await client.get("/api/v1/message-templates")
    assert any(item["id"] == template_id for item in seen.json()["data"]["items"])
    me = await client.get("/api/v1/auth/me")
    assert me.json()["data"]["mobile"] == "9123456789"

    assert (await login(client, email="other.templates@example.com")).status_code == 200
    hidden = await client.get(f"/api/v1/message-templates/{template_id}/image")
    assert hidden.status_code == 404


async def test_new_business_starts_with_default_templates(client):
    _add_member("platform.templates@example.com", "SUPER_ADMIN")
    assert (await login(client, email="platform.templates@example.com")).status_code == 200
    created = await client.post(
        "/api/v1/businesses",
        json={"name": "Template Works", "status": "active"},
        headers=await csrf_headers(client),
    )
    assert created.status_code == 200, created.text
    company_id = created.json()["data"]["id"]
    _add_member("owner.defaults@example.com", "BUSINESS_OWNER", uuid.UUID(company_id))

    assert (await login(client, email="owner.defaults@example.com")).status_code == 200
    listed = await client.get("/api/v1/message-templates")
    assert listed.status_code == 200, listed.text
    titles = {item["title"] for item in listed.json()["data"]["items"]}
    assert titles == {"Welcome", "Follow-up", "Thank you"}


async def test_salesperson_mobile_is_required(client):
    company_id = _add_company("Mobile Co")
    _add_member("owner.mobile@example.com", "BUSINESS_OWNER", company_id)
    assert (await login(client, email="owner.mobile@example.com")).status_code == 200
    rejected = await client.post(
        "/api/v1/team/salespeople",
        json={"full_name": "No Number", "email": "no.number@example.com", "password": VALID_PASSWORD},
        headers=await csrf_headers(client),
    )
    assert rejected.status_code == 422
    saved = await client.patch(
        "/api/v1/team/mobile",
        json={"mobile": "98 765 43210"},
        headers=await csrf_headers(client),
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["data"]["viewer"]["mobile"] == "9876543210"
