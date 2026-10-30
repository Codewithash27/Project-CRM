"""Team board request and response schemas."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _collapse(value: str) -> str:
    return " ".join(value.split())


class TeamProject(BaseModel):
    id: str
    name: str
    code: str
    company_id: str
    company_name: str


class TeamPerson(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    company_id: str | None
    company_name: str | None


class TeamAssignment(BaseModel):
    project_id: str
    user_id: str


class TeamLeadCount(BaseModel):
    project_id: str
    user_id: str
    count: int


class TeamCompany(BaseModel):
    id: str
    name: str


class TeamBoardData(BaseModel):
    mode: Literal["platform", "owner"]
    companies: list[TeamCompany]
    projects: list[TeamProject]
    people: list[TeamPerson]
    assignments: list[TeamAssignment]
    lead_counts: list[TeamLeadCount]
    viewer: TeamPerson


class SetAssignmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: uuid.UUID
    user_id: uuid.UUID
    assigned: bool


class CreateSalespersonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = _collapse(value)
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return cleaned

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        return value.strip().lower()


class MoveLeadsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: uuid.UUID
    from_user_id: uuid.UUID
    to_user_id: uuid.UUID
    which: Literal["all"] = "all"


class MoveLeadsResult(BaseModel):
    moved: int
