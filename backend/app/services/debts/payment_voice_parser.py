import re
import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.services.debts.debt_service import get_debt_owned_by_user
from app.services.transactions.drafts.entity_parser import parse_transaction_entities
from app.services.voiceEntry.correction.correction_service import correct_transcript

_DAYS_AGO_RE = re.compile(r"hace\s+(\d+)\s+d[ií]as?")


@dataclass
class ParsedDebtPaymentVoice:
    amount: float | None
    currency: str
    paid_at: date
    note: str


def parse_relative_date_phrase(text: str, today: date | None = None) -> date:
    """Reconoce un subconjunto chico y explícito de fechas relativas dichas en voz
    (pedido explícito del usuario: "hoy", "ayer", "hace 3 días", sin obligar a decir
    una fecha precisa). Cualquier frase no reconocida ("este mes", "esta semana", o
    nada) cae en `today` - no hay forma de saber el día exacto sin más precisión, y
    el usuario siempre puede corregir la fecha a mano antes de confirmar el pago, así
    que un default razonable es preferible a fallar."""
    today = today or date.today()
    lowered = text.lower()

    if "anteayer" in lowered:
        return today - timedelta(days=2)
    if "ayer" in lowered:
        return today - timedelta(days=1)

    match = _DAYS_AGO_RE.search(lowered)
    if match:
        return today - timedelta(days=int(match.group(1)))

    if "semana pasada" in lowered:
        return today - timedelta(days=7)

    return today


def parse_debt_payment_voice(text: str, default_currency: str) -> ParsedDebtPaymentVoice:
    """Extrae monto/moneda (parser ya compartido con voiceEntry/receiptScanner) y
    fecha relativa de un transcript hablado sobre un pago de deuda - ej. "hoy me
    pagaron 50 usdt". Solo parsea: quien llama decide qué hacer con el resultado
    (acá, precargar el formulario de "Registrar pago" para que el usuario confirme)."""
    parsed = parse_transaction_entities(text, default_currency)
    return ParsedDebtPaymentVoice(
        amount=parsed.amount,
        currency=parsed.currency,
        paid_at=parse_relative_date_phrase(text),
        note=text.strip(),
    )


def parse_debt_payment_transcript(
    db: Session, debt_id: uuid.UUID, user_id: uuid.UUID, transcript: str
) -> ParsedDebtPaymentVoice:
    """Corrige el transcript (mismos términos propios del usuario que voiceEntry, ver
    correction_service.py) y lo parsea con la moneda de la deuda como default - "hoy
    me pagaron 50" sin moneda explícita asume la moneda de la deuda, no USD a secas."""
    debt = get_debt_owned_by_user(db, debt_id, user_id)
    corrected = correct_transcript(db, user_id, transcript).text
    return parse_debt_payment_voice(corrected, debt.currency)
