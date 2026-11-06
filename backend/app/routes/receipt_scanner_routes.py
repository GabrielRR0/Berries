from fastapi import APIRouter

from app.modules.receipt_scanner.controllers.receipt_scanner_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router, prefix="/receipt-scanner", tags=["receiptScanner"])
