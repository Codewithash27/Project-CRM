"""WhatsApp template HTTP routes."""

import uuid

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import client_ip, get_current_user
from app.common.responses import ApiResponse, error_responses
from app.core.database import get_db
from app.message_templates.schemas import MessageTemplateListData, MessageTemplatePublic, to_public
from app.message_templates.service import (
    create_template,
    delete_template,
    get_template_image,
    list_templates,
    media_type_for,
    update_template,
)
from app.users.models import User

router = APIRouter()


@router.get(
    "",
    response_model=ApiResponse[MessageTemplateListData],
    summary="List WhatsApp templates for the caller's company",
    responses=error_responses(401, 403),
)
def get_templates(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[MessageTemplateListData]:
    items = [to_public(template) for template in list_templates(db, actor)]
    return ApiResponse(data=MessageTemplateListData(items=items), message="Success")


@router.post(
    "",
    response_model=ApiResponse[MessageTemplatePublic],
    summary="Create a WhatsApp template",
    responses=error_responses(401, 403, 409, 422),
)
async def post_template(
    request: Request,
    title: str = Form(),
    message: str = Form(),
    color: str = Form(default="#128C7E"),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[MessageTemplatePublic]:
    template = await create_template(
        db,
        actor,
        title=title,
        message=message,
        color=color,
        image=image,
        ip_address=client_ip(request),
    )
    return ApiResponse(data=to_public(template), message="Template saved.")


@router.get(
    "/{template_id}/image",
    summary="Download a template image",
    responses=error_responses(401, 403, 404),
)
def get_image(
    template_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> FileResponse:
    _template, path = get_template_image(db, actor, template_id)
    return FileResponse(path, media_type=media_type_for(path))


@router.patch(
    "/{template_id}",
    response_model=ApiResponse[MessageTemplatePublic],
    summary="Update a WhatsApp template",
    responses=error_responses(401, 403, 404, 409, 422),
)
async def patch_template(
    template_id: uuid.UUID,
    request: Request,
    title: str = Form(),
    message: str = Form(),
    color: str = Form(default="#128C7E"),
    remove_image: bool = Form(default=False),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[MessageTemplatePublic]:
    template = await update_template(
        db,
        actor,
        template_id,
        title=title,
        message=message,
        color=color,
        image=image,
        remove_image=remove_image,
        ip_address=client_ip(request),
    )
    return ApiResponse(data=to_public(template), message="Template updated.")


@router.delete(
    "/{template_id}",
    response_model=ApiResponse[MessageTemplatePublic],
    summary="Delete a WhatsApp template",
    responses=error_responses(401, 403, 404),
)
def remove_template(
    template_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> ApiResponse[MessageTemplatePublic]:
    payload = delete_template(db, actor, template_id, client_ip(request))
    return ApiResponse(data=payload, message="Template deleted.")
