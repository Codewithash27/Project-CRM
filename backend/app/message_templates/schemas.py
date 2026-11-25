"""Message template request and response schemas."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.message_templates.models import MessageTemplate


def _collapse(value: str) -> str:
    return " ".join(value.split())


class MessageTemplatePublic(BaseModel):
    id: str
    title: str
    message: str
    color: str
    has_image: bool
    created_at: datetime
    updated_at: datetime


class MessageTemplateListData(BaseModel):
    items: list[MessageTemplatePublic]


class TemplateText(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=1, max_length=2000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        cleaned = _collapse(value)
        if len(cleaned) < 2:
            raise ValueError("Title must be at least 2 characters.")
        return cleaned

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message is required.")
        if len(cleaned) > 2000:
            raise ValueError("Message is too long.")
        return cleaned


def parse_template_text(title: str, message: str) -> TemplateText:
    return TemplateText(title=title, message=message)


def to_public(template: MessageTemplate) -> MessageTemplatePublic:
    return MessageTemplatePublic(
        id=str(template.id),
        title=template.title,
        message=template.message,
        color=template.color,
        has_image=bool(template.image_name),
        created_at=template.created_at,
        updated_at=template.updated_at,
    )
