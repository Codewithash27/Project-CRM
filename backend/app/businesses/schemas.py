"""Business request and response schemas."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

BusinessStatus = Literal["active", "inactive"]
PLAN_LABELS = ("Free", "Starter", "Pro", "Enterprise")
INDUSTRIES = (
    "Technology",
    "Education",
    "Food & Beverage",
    "Retail",
    "Healthcare",
    "Real Estate",
    "Manufacturing",
    "Services",
    "Other",
)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^[+\d][\d\s\-()]{6,18}$")
_GST_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_URL_RE = re.compile(r"^(https?://)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(/.*)?$")


def _collapse(value: str) -> str:
    return " ".join(value.split())


def _optional_text(value: str | None, *, max_len: int) -> str | None:
    if value is None:
        return None
    cleaned = _collapse(value)
    if not cleaned:
        return None
    if len(cleaned) > max_len:
        raise ValueError(f"Must be at most {max_len} characters.")
    return cleaned


class BusinessProfileFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=100)
    website: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=500)
    gst_number: str | None = Field(default=None, max_length=30)
    remarks: str | None = Field(default=None, max_length=1000)
    plan_label: str | None = Field(default=None, max_length=20)
    status: BusinessStatus = "active"

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = _collapse(value)
        if len(cleaned) < 2:
            raise ValueError("Business name must be at least 2 characters.")
        return cleaned

    @field_validator("industry")
    @classmethod
    def clean_industry(cls, value: str | None) -> str | None:
        cleaned = _optional_text(value, max_len=100)
        if cleaned is None:
            return None
        if cleaned not in INDUSTRIES:
            raise ValueError("Choose an industry from the list.")
        return cleaned

    @field_validator("website")
    @classmethod
    def clean_website(cls, value: str | None) -> str | None:
        cleaned = _optional_text(value, max_len=255)
        if cleaned is None:
            return None
        if not _URL_RE.match(cleaned):
            raise ValueError("Enter a valid website such as example.com.")
        if not cleaned.startswith(("http://", "https://")):
            cleaned = f"https://{cleaned}"
        return cleaned

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str | None) -> str | None:
        cleaned = _optional_text(value, max_len=150)
        if cleaned is None:
            return None
        cleaned = cleaned.lower()
        if not _EMAIL_RE.match(cleaned):
            raise ValueError("Enter a valid business email.")
        return cleaned

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, value: str | None) -> str | None:
        cleaned = _optional_text(value, max_len=20)
        if cleaned is None:
            return None
        if not _PHONE_RE.match(cleaned):
            raise ValueError("Enter a valid phone number.")
        return cleaned

    @field_validator("city")
    @classmethod
    def clean_city(cls, value: str | None) -> str | None:
        return _optional_text(value, max_len=100)

    @field_validator("address")
    @classmethod
    def clean_address(cls, value: str | None) -> str | None:
        return _optional_text(value, max_len=500)

    @field_validator("gst_number")
    @classmethod
    def clean_gst(cls, value: str | None) -> str | None:
        cleaned = _optional_text(value, max_len=30)
        if cleaned is None:
            return None
        cleaned = cleaned.upper().replace(" ", "")
        if not _GST_RE.match(cleaned):
            raise ValueError("Enter a valid 15-character GSTIN.")
        return cleaned

    @field_validator("remarks")
    @classmethod
    def clean_remarks(cls, value: str | None) -> str | None:
        return _optional_text(value, max_len=1000)

    @field_validator("plan_label")
    @classmethod
    def clean_plan(cls, value: str | None) -> str | None:
        cleaned = _optional_text(value, max_len=20)
        if cleaned is None:
            return None
        if cleaned not in PLAN_LABELS:
            raise ValueError("Choose Free, Starter, Pro, or Enterprise.")
        return cleaned


class CreateBusinessRequest(BusinessProfileFields):
    status: BusinessStatus = "active"


class UpdateBusinessRequest(BusinessProfileFields):
    status: BusinessStatus


class BusinessPublic(BaseModel):
    id: str
    name: str
    status: str
    plan_label: str | None
    industry: str | None
    website: str | None
    email: str | None
    phone: str | None
    city: str | None
    address: str | None
    gst_number: str | None
    remarks: str | None
    user_count: int
    project_count: int
    team_count: int
    lead_count: int
    can_delete: bool


class BusinessListData(BaseModel):
    can_manage: bool
    items: list[BusinessPublic]
