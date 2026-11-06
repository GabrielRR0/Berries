"""Fachada del módulo: los controllers y la API pública solo hablan con esto."""

from app.modules.receipt_scanner.services.receipt_scanner_service import submit_receipt_scan

__all__ = ["submit_receipt_scan"]
