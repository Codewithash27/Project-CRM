"""Create, list, update, and delete company WhatsApp templates."""

import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit.service import record_audit
from app.common.exceptions import AppError, ErrorCode
from app.core.config import get_settings
from app.core.logging import log_event
from app.message_templates.models import MessageTemplate
from app.message_templates.schemas import MessageTemplatePublic, TemplateText, parse_template_text, to_public
from app.roles.service import RoleName
from app.users.models import User

logger = logging.getLogger("app.message_templates")

MAX_IMAGE_BYTES = 5 * 1024 * 1024

DEFAULT_TEMPLATES = (
    ("Welcome", "Hi {name}, thank you for your enquiry. How can I help you today?", "#128C7E"),
    (
        "Follow-up",
        "Hi {name}, I am following up on our last conversation. Please let me know a good time to talk.",
        "#1D4ED8",
    ),
    ("Thank you", "Hi {name}, thank you for your time. Message me if you need anything else.", "#7C3AED"),
)

TEMPLATE_COLORS = (
    "#128C7E",
    "#0F766E",
    "#047857",
    "#1D4ED8",
    "#0369A1",
    "#7C3AED",
    "#BE123C",
    "#B45309",
)


def _forbidden() -> AppError:
    return AppError(ErrorCode.FORBIDDEN, "You do not have permission to perform this action.", 403)


def _validation(field: str, code: str, message: str) -> AppError:
    return AppError(
        ErrorCode.VALIDATION_ERROR,
        message,
        422,
        details=[{"field": field, "code": code, "message": message}],
    )


def _company_id(actor: User) -> uuid.UUID:
    names = {link.role.name for link in actor.user_roles}
    if actor.company_id is None or not names & {RoleName.BUSINESS_OWNER, RoleName.SALESPERSON}:
        raise _forbidden()
    return actor.company_id


def ensure_default_templates(db: Session, company_id: uuid.UUID) -> None:
    """Insert the starter templates. Caller commits."""

    now = datetime.now(UTC)
    for title, message, color in DEFAULT_TEMPLATES:
        db.add(
            MessageTemplate(
                company_id=company_id,
                title=title,
                message=message,
                color=color,
                image_name=None,
                created_by_id=None,
                created_at=now,
                updated_at=now,
            )
        )


def list_templates(db: Session, actor: User) -> list[MessageTemplate]:
    company_id = _company_id(actor)
    return list(
        db.scalars(
            select(MessageTemplate)
            .where(MessageTemplate.company_id == company_id)
            .order_by(MessageTemplate.title)
        ).all()
    )


def _get_owned(db: Session, actor: User, template_id: uuid.UUID) -> MessageTemplate:
    template = db.get(MessageTemplate, template_id)
    if template is None or template.company_id != _company_id(actor):
        raise AppError(ErrorCode.NOT_FOUND, "Template not found.", 404)
    return template


def _image_dir() -> Path:
    directory = Path(get_settings().template_image_dir)
    directory.mkdir(parents=True, exist_ok=True)
    return directory.resolve()


def _image_extension(data: bytes) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    raise _validation("image", "INVALID_IMAGE", "Upload a JPG, PNG, or WebP image.")


async def _read_image(image: UploadFile | None) -> tuple[bytes, str] | None:
    if image is None or not image.filename:
        return None
    data = await image.read()
    if not data:
        return None
    if len(data) > MAX_IMAGE_BYTES:
        raise _validation("image", "IMAGE_TOO_LARGE", "Image must be 5 MB or smaller.")
    return data, _image_extension(data)


def _store_image(template_id: uuid.UUID, data: bytes, extension: str) -> str:
    name = f"{template_id}{extension}"
    path = _image_dir() / name
    path.write_bytes(data)
    return name


def _delete_image(image_name: str | None) -> None:
    if not image_name or "/" in image_name or "\\" in image_name or image_name.startswith("."):
        return
    path = _image_dir() / image_name
    if path.is_file():
        path.unlink()


def image_file(template: MessageTemplate) -> Path:
    if not template.image_name:
        raise AppError(ErrorCode.NOT_FOUND, "This template has no image.", 404)
    directory = _image_dir()
    path = (directory / template.image_name).resolve()
    if not path.is_relative_to(directory) or not path.is_file():
        raise AppError(ErrorCode.NOT_FOUND, "This template has no image.", 404)
    return path


def normalize_color(value: str | None) -> str:
    raw = (value or "").strip().upper()
    if raw and not raw.startswith("#"):
        raw = f"#{raw}"
    for allowed in TEMPLATE_COLORS:
        if allowed.upper() == raw:
            return allowed
    raise _validation("color", "INVALID_COLOR", "Choose a template color.")


def _duplicate_title() -> AppError:
    return AppError(ErrorCode.CONFLICT, "A template with this title already exists.", 409)


def _title_taken(db: Session, company_id: uuid.UUID, title: str, exclude_id: uuid.UUID | None) -> bool:
    stmt = select(MessageTemplate.id).where(
        MessageTemplate.company_id == company_id,
        func.lower(MessageTemplate.title) == title.lower(),
    )
    if exclude_id is not None:
        stmt = stmt.where(MessageTemplate.id != exclude_id)
    return db.scalar(stmt.limit(1)) is not None


async def create_template(
    db: Session,
    actor: User,
    *,
    title: str,
    message: str,
    color: str,
    image: UploadFile | None,
    ip_address: str | None,
) -> MessageTemplate:
    company_id = _company_id(actor)
    text = _text_or_error(title, message)
    accent = normalize_color(color)
    if _title_taken(db, company_id, text.title, None):
        raise _duplicate_title()
    uploaded = await _read_image(image)
    now = datetime.now(UTC)
    template = MessageTemplate(
        company_id=company_id,
        title=text.title,
        message=text.message,
        color=accent,
        image_name=None,
        created_by_id=actor.id,
        created_at=now,
        updated_at=now,
    )
    db.add(template)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise _duplicate_title() from None
    if uploaded is not None:
        data, extension = uploaded
        template.image_name = _store_image(template.id, data, extension)
    record_audit(
        db,
        action="message_template_created",
        actor_id=actor.id,
        target_type="message_template",
        target_id=template.id,
        context={"title": template.title, "has_image": template.image_name is not None},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(template)
    log_event(logger, "message_template_created", actor_id=str(actor.id), template_id=str(template.id))
    return template


def _text_or_error(title: str, message: str) -> TemplateText:
    try:
        return parse_template_text(title, message)
    except Exception as exc:
        _raise_text_error(exc)
        raise


def _raise_text_error(exc: Exception) -> None:
    """Turn a pydantic validation error into a field error."""

    errors = getattr(exc, "errors", None)
    if not callable(errors):
        return
    details = errors()
    if not details:
        raise _validation("request", "INVALID", "Enter a valid template.") from exc
    first = details[0]
    loc = first.get("loc") or ("request",)
    field = str(loc[-1])
    raw = str(first.get("msg", "Enter a valid value.")).removeprefix("Value error, ").strip().rstrip(".")
    raise _validation(field, "INVALID", f"{raw}.") from exc


async def update_template(
    db: Session,
    actor: User,
    template_id: uuid.UUID,
    *,
    title: str,
    message: str,
    color: str,
    image: UploadFile | None,
    remove_image: bool,
    ip_address: str | None,
) -> MessageTemplate:
    template = _get_owned(db, actor, template_id)
    text = _text_or_error(title, message)
    accent = normalize_color(color)
    if _title_taken(db, template.company_id, text.title, template.id):
        raise _duplicate_title()
    uploaded = await _read_image(image)
    previous_image = template.image_name
    template.title = text.title
    template.message = text.message
    template.color = accent
    template.updated_at = datetime.now(UTC)
    if uploaded is not None:
        data, extension = uploaded
        template.image_name = _store_image(template.id, data, extension)
        if previous_image and previous_image != template.image_name:
            _delete_image(previous_image)
    elif remove_image and previous_image:
        _delete_image(previous_image)
        template.image_name = None
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise _duplicate_title() from None
    record_audit(
        db,
        action="message_template_updated",
        actor_id=actor.id,
        target_type="message_template",
        target_id=template.id,
        context={"title": template.title, "has_image": template.image_name is not None},
        ip_address=ip_address,
    )
    db.commit()
    db.refresh(template)
    log_event(logger, "message_template_updated", actor_id=str(actor.id), template_id=str(template.id))
    return template


def delete_template(
    db: Session,
    actor: User,
    template_id: uuid.UUID,
    ip_address: str | None,
) -> MessageTemplatePublic:
    template = _get_owned(db, actor, template_id)
    payload = to_public(template)
    image_name = template.image_name
    record_audit(
        db,
        action="message_template_deleted",
        actor_id=actor.id,
        target_type="message_template",
        target_id=template.id,
        context={"title": template.title},
        ip_address=ip_address,
    )
    db.delete(template)
    db.commit()
    _delete_image(image_name)
    log_event(logger, "message_template_deleted", actor_id=str(actor.id), template_id=str(template_id))
    return payload


def get_template_image(db: Session, actor: User, template_id: uuid.UUID) -> tuple[MessageTemplate, Path]:
    template = _get_owned(db, actor, template_id)
    return template, image_file(template)


def media_type_for(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".png":
        return "image/png"
    if suffix == ".webp":
        return "image/webp"
    return "image/jpeg"
