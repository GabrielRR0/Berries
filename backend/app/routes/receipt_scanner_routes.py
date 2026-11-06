from fastapi import APIRouter

from app.modules.receipt_scanner import receipt_scanner_routers


def register(api: APIRouter) -> None:
    for router in receipt_scanner_routers:
        api.include_router(router, prefix="/receipt-scanner", tags=["receiptScanner"])
