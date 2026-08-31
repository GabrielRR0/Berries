from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.auth.user_model import User
from app.schemas.receiptScanner.receipt_scanner_schemas import DraftResponse
from app.services.receiptScanner.errors import OcrNotConfiguredError
from app.services.receiptScanner.receipt_scanner_service import submit_receipt_scan

router = APIRouter()


@router.post("", response_model=DraftResponse, status_code=status.HTTP_201_CREATED)
async def create(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DraftResponse:
    image_bytes = await image.read()
    try:
        draft = submit_receipt_scan(
            db,
            current_user.id,
            current_user.default_currency,
            image_bytes,
            image.filename or "receipt",
        )
    except OcrNotConfiguredError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return DraftResponse.model_validate(draft)
