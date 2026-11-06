"""Fachada del módulo: los controllers y la API pública solo hablan con esto."""

from app.modules.debts.services.debt_payment_service import create_debt_payment, delete_debt_payment
from app.modules.debts.services.debt_service import (
    build_debt_response,
    create_debt,
    delete_debt,
    get_debt_owned_by_user,
    get_debt_summary,
    list_debts_for_user,
)
from app.modules.debts.services.installment_service import (
    mark_installment_paid,
    mark_installment_unpaid,
    pay_installment_of_debt,
    unpay_installment_of_debt,
)
from app.modules.debts.services.payment_voice_parser import parse_debt_payment_transcript

__all__ = [
    "build_debt_response",
    "create_debt",
    "create_debt_payment",
    "delete_debt",
    "delete_debt_payment",
    "get_debt_owned_by_user",
    "get_debt_summary",
    "list_debts_for_user",
    "mark_installment_paid",
    "mark_installment_unpaid",
    "parse_debt_payment_transcript",
    "pay_installment_of_debt",
    "unpay_installment_of_debt",
]
