"""Role request and response schemas."""

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.roles.models import Role

_ROLE_CODE = re.compile(r"^[A-Z][A-Z0-9_]{1,49}$")


class PermissionPublic(BaseModel):
    id: str
    key: str
    description: str


class RolePublic(BaseModel):
    id: str
    name: str
    description: str
    permissions: list[PermissionPublic]
    is_system: bool = False


class CreateRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=50)
    description: str = Field(default="", max_length=500)
    permissions: list[str] = Field(default_factory=list, max_length=200)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9]+", "_", value.strip()).strip("_").upper()
        if len(cleaned) < 2 or _ROLE_CODE.fullmatch(cleaned) is None:
            raise ValueError("Use letters, numbers, or spaces. The role code must start with a letter.")
        return cleaned

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("permissions")
    @classmethod
    def unique_permissions(cls, value: list[str]) -> list[str]:
        cleaned = []
        seen: set[str] = set()
        for item in value:
            key = item.strip()
            if not key or key in seen:
                continue
            seen.add(key)
            cleaned.append(key)
        if not cleaned:
            raise ValueError("Tick at least one permission for this role.")
        return cleaned


class UpdateRolePermissionsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    permissions: list[str] = Field(min_length=1, max_length=200)

    @field_validator("permissions")
    @classmethod
    def unique_permissions(cls, value: list[str]) -> list[str]:
        cleaned = []
        seen: set[str] = set()
        for item in value:
            key = item.strip()
            if not key or key in seen:
                continue
            seen.add(key)
            cleaned.append(key)
        if not cleaned:
            raise ValueError("Tick at least one permission for this role.")
        return cleaned


SYSTEM_ROLES = frozenset(
    {
        "SUPER_ADMIN",
        "BUSINESS_OWNER",
        "MARKETING",
        "SALESPERSON",
    }
)


def to_role_public(role: Role) -> RolePublic:
    permissions = [
        PermissionPublic(
            id=str(link.permission.id),
            key=link.permission.key,
            description=link.permission.description,
        )
        for link in role.role_permissions
    ]
    permissions.sort(key=lambda item: item.key)
    return RolePublic(
        id=str(role.id),
        name=role.name,
        description=role.description,
        permissions=permissions,
        is_system=role.name in SYSTEM_ROLES,
    )
