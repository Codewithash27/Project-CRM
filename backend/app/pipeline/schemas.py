"""Pipeline stage request and response schemas."""

import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.pipeline.models import PipelineStage

_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,39}$")
_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def slug_key(label: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    return (cleaned or "stage")[:40]


def is_valid_key(value: str) -> bool:
    return _KEY_RE.fullmatch(value) is not None


def _collapse(value: str) -> str:
    return " ".join(value.split())


class CreatePipelineStageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: uuid.UUID
    label: str = Field(min_length=2, max_length=40)
    color: str = Field(default="#64748b", min_length=7, max_length=7)
    is_won: bool = False
    is_lost: bool = False

    @field_validator("label")
    @classmethod
    def clean_label(cls, value: str) -> str:
        cleaned = _collapse(value)
        if len(cleaned) < 2:
            raise ValueError("Label must be 2 to 40 characters.")
        return cleaned

    @field_validator("color")
    @classmethod
    def clean_color(cls, value: str) -> str:
        cleaned = value.strip()
        if _COLOR_RE.fullmatch(cleaned) is None:
            raise ValueError("Color must be a hex value like #3b82f6.")
        return cleaned.lower()


class UpdatePipelineStageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str | None = Field(default=None, min_length=2, max_length=40)
    color: str | None = Field(default=None, min_length=7, max_length=7)
    is_won: bool | None = None
    is_lost: bool | None = None

    @field_validator("label")
    @classmethod
    def clean_label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = _collapse(value)
        if len(cleaned) < 2:
            raise ValueError("Label must be 2 to 40 characters.")
        return cleaned

    @field_validator("color")
    @classmethod
    def clean_color(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if _COLOR_RE.fullmatch(cleaned) is None:
            raise ValueError("Color must be a hex value like #3b82f6.")
        return cleaned.lower()


class ReorderPipelineStagesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: uuid.UUID
    stage_ids: list[uuid.UUID] = Field(min_length=1)


class DeletePipelineStageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    move_to_stage_key: str | None = Field(default=None, max_length=40)


class PipelineStagePublic(BaseModel):
    id: str
    project_id: str
    key: str
    label: str
    color: str
    sort_order: int
    is_entry: bool
    is_won: bool
    is_lost: bool
    is_locked: bool
    lead_count: int = 0


class PipelineStageListData(BaseModel):
    items: list[PipelineStagePublic]
    project_id: str


def to_stage_public(stage: PipelineStage, lead_count: int = 0) -> PipelineStagePublic:
    from app.pipeline.models import ENTRY_KEY

    return PipelineStagePublic(
        id=str(stage.id),
        project_id=str(stage.project_id),
        key=stage.key,
        label=stage.label,
        color=stage.color,
        sort_order=stage.sort_order,
        is_entry=stage.is_entry,
        is_won=stage.is_won,
        is_lost=stage.is_lost,
        is_locked=stage.key == ENTRY_KEY or stage.is_entry,
        lead_count=lead_count,
    )
