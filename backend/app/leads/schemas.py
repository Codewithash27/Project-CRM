"""Lead request and response schemas."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.auth.schemas import normalize_email
from app.leads.models import Lead

LeadStatus = Literal["new", "contacted", "qualified", "unqualified", "lost"]
LeadPriority = Literal["low", "medium", "high"]


def _collapse(value: str) -> str:
    return " ".join(value.split())


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class CreateLeadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=1, max_length=120)
    mobile: str = Field(min_length=1, max_length=20)
    alternate_mobile: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = Field(default=None, max_length=150)
    company_name: str | None = Field(default=None, max_length=150)
    city: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=4000)
    requirement: str | None = Field(default=None, max_length=4000)
    expected_value: Decimal | None = Field(default=None, ge=0, max_digits=15, decimal_places=2)
    lead_source: str | None = Field(default=None, max_length=80)
    owner_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None
    status: LeadStatus = "new"
    priority: LeadPriority = "medium"
    next_followup_at: datetime

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str) -> str:
        cleaned = _collapse(value)
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return cleaned

    @field_validator("email", mode="before")
    @classmethod
    def blank_email(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = normalize_email(value)
            return cleaned or None
        return value

    @field_validator("company_name", "city", "lead_source")
    @classmethod
    def clean_short_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _optional_text(_collapse(value))

    @field_validator("address", "requirement", "alternate_mobile", "mobile")
    @classmethod
    def clean_free_text(cls, value: str | None) -> str | None:
        return _optional_text(value)


class UpdateLeadRequest(BaseModel):
    """Omitted fields stay unchanged. Null clears an optional text field."""

    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, max_length=120)
    mobile: str | None = Field(default=None, max_length=20)
    alternate_mobile: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = Field(default=None, max_length=150)
    company_name: str | None = Field(default=None, max_length=150)
    city: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=4000)
    requirement: str | None = Field(default=None, max_length=4000)
    expected_value: Decimal | None = Field(default=None, ge=0, max_digits=15, decimal_places=2)
    lead_source: str | None = Field(default=None, max_length=80)
    owner_id: uuid.UUID | None = None
    status: LeadStatus | None = None
    priority: LeadPriority | None = None
    next_followup_at: datetime | None = None

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = _collapse(value)
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return cleaned

    @field_validator("email", mode="before")
    @classmethod
    def blank_email(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = normalize_email(value)
            return cleaned or None
        return value

    @field_validator("company_name", "city", "lead_source")
    @classmethod
    def clean_short_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _optional_text(_collapse(value))

    @field_validator("address", "requirement", "alternate_mobile", "mobile")
    @classmethod
    def clean_free_text(cls, value: str | None) -> str | None:
        return _optional_text(value)


class LeadPublic(BaseModel):
    id: str
    company_id: str
    lead_number: str
    full_name: str
    mobile: str
    alternate_mobile: str | None
    email: str | None
    company_name: str | None
    city: str | None
    address: str | None
    requirement: str | None
    expected_value: str | None
    lead_source: str | None
    owner_id: str
    created_by_id: str
    status: str
    priority: str
    next_followup_at: datetime | None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class LeadListData(BaseModel):
    items: list[LeadPublic]
    total: int


def to_lead_public(lead: Lead) -> LeadPublic:
    expected = None if lead.expected_value is None else f"{lead.expected_value:.2f}"
    return LeadPublic(
        id=str(lead.id),
        company_id=str(lead.company_id),
        lead_number=lead.lead_number,
        full_name=lead.full_name,
        mobile=lead.mobile,
        alternate_mobile=lead.alternate_mobile,
        email=lead.email,
        company_name=lead.company_name,
        city=lead.city,
        address=lead.address,
        requirement=lead.requirement,
        expected_value=expected,
        lead_source=lead.lead_source,
        owner_id=str(lead.owner_id),
        created_by_id=str(lead.created_by_id),
        status=lead.status,
        priority=lead.priority,
        next_followup_at=lead.next_followup_at,
        is_deleted=lead.is_deleted,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )
