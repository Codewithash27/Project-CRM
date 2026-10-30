"""User access-management schemas."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.auth.schemas import RegisteredUser, UserProfile, normalize_email
from app.permissions.service import get_permission_keys
from app.users.models import User


class AccessUser(BaseModel):
    id: str
    full_name: str
    email: str
    roles: list[str]
    is_active: bool
    company_id: str | None
    team_id: str | None
    manager_id: str | None


class UserListData(BaseModel):
    items: list[AccessUser]
    total: int


class AssignRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str = Field(min_length=1, max_length=50, description="Role name to assign. Replaces existing roles.")


class UpdateStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool


class CreateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    role: str = Field(min_length=1, max_length=50)
    company_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    preferred_language: Literal["en", "mr", "hi"] = "en"
    is_active: bool = True

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return cleaned

    @field_validator("email", mode="before")
    @classmethod
    def lowercase_email(cls, value: object) -> object:
        if isinstance(value, str):
            return normalize_email(value)
        return value


class UpdateManagedUserRequest(BaseModel):
    """Fields the caller sent are tracked so null can clear team or manager."""

    model_config = ConfigDict(extra="forbid")

    role: str | None = None
    team_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    is_active: bool | None = None


def role_names(user: User) -> list[str]:
    return sorted(link.role.name for link in user.user_roles)


def to_registered_user(user: User) -> RegisteredUser:
    return RegisteredUser(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        preferred_language=user.preferred_language,
        roles=role_names(user),
    )


def _optional_id(value: uuid.UUID | None) -> str | None:
    if value is None:
        return None
    return str(value)


def to_user_profile(db: Session, user: User) -> UserProfile:
    return UserProfile(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        preferred_language=user.preferred_language,
        is_active=user.is_active,
        email_verified=user.email_verified,
        company_id=_optional_id(user.company_id),
        team_id=_optional_id(user.team_id),
        manager_id=_optional_id(user.manager_id),
        roles=role_names(user),
        permissions=sorted(get_permission_keys(db, user.id)),
    )


def to_access_user(user: User) -> AccessUser:
    return AccessUser(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        roles=role_names(user),
        is_active=user.is_active,
        company_id=_optional_id(user.company_id),
        team_id=_optional_id(user.team_id),
        manager_id=_optional_id(user.manager_id),
    )
