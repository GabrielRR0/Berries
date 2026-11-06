from fastapi import File, UploadFile, status

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.receipt_scanner import services
from app.modules.transactions import DraftResource

router = auth_group()


@router.post("", response_model=DraftResource, status_code=status.HTTP_201_CREATED)
async def create(db: DbSession, user: CurrentUser, image: UploadFile = File(...)) -> DraftResource:
    image_bytes = await image.read()
    draft = services.submit_receipt_scan(db, user.id, user.default_currency, image_bytes, image.filename or "receipt")
    return DraftResource.model_validate(draft)
