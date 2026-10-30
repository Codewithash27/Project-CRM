"""Super Admin can create roles and edit the permission map."""

import uuid

from tests.helpers import assign_role, csrf_headers, login, register_student


async def _admin(client) -> None:
    email = f"role-admin-{uuid.uuid4().hex[:8]}@example.com"
    assert (await register_student(client, email=email, full_name="Role Admin")).status_code == 201
    assign_role(email, "SUPER_ADMIN")
    assert (await login(client, email=email)).status_code == 200


async def test_super_admin_creates_and_updates_role_permissions(client):
    await _admin(client)
    suffix = uuid.uuid4().hex[:6].upper()

    created = await client.post(
        "/api/v1/roles",
        json={
            "name": f"Telecaller {suffix}",
            "description": "Works own leads by phone",
            "permissions": ["features.read", "leads.read", "leads.create"],
        },
        headers=await csrf_headers(client),
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    assert body["name"] == f"TELECALLER_{suffix}"
    assert body["is_system"] is False
    assert {item["key"] for item in body["permissions"]} == {
        "features.read",
        "leads.read",
        "leads.create",
    }

    updated = await client.patch(
        f"/api/v1/roles/{body['id']}/permissions",
        json={"permissions": ["features.read", "leads.read"]},
        headers=await csrf_headers(client),
    )
    assert updated.status_code == 200, updated.text
    assert {item["key"] for item in updated.json()["data"]["permissions"]} == {
        "features.read",
        "leads.read",
    }

    roles = await client.get("/api/v1/roles")
    assert roles.status_code == 200
    names = {role["name"] for role in roles.json()["data"]}
    assert f"TELECALLER_{suffix}" in names


async def test_duplicate_role_name_is_rejected(client):
    await _admin(client)
    headers = await csrf_headers(client)
    name = f"Field Sales {uuid.uuid4().hex[:6]}"
    payload = {"name": name, "permissions": ["features.read"]}
    first = await client.post("/api/v1/roles", json=payload, headers=headers)
    assert first.status_code == 201, first.text
    second = await client.post("/api/v1/roles", json=payload, headers=headers)
    assert second.status_code == 409
