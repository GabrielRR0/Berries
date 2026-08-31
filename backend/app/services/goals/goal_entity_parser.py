"""Parser de titulo/monto/fecha objetivo para metas dichas en texto libre (español) -
mismo espiritu que transactions/drafts/entity_parser.py: heuristicas de regex simples,
sin ML ni llamadas externas, nunca una promesa de precision perfecta (por eso el
formulario de creacion siempre deja estos campos editables antes de guardar)."""

import calendar
import re
from dataclasses import dataclass
from datetime import date, timedelta

from app.services.transactions.drafts.entity_parser import extract_currency

_AMOUNT_RE = re.compile(r"\d[\d.,]*\d|\d")
_MONTHLY_MARKERS = ("al mes", "por mes", "cada mes", "mensual", "mensuales")

# "un"/"una" SOLO cuentan como numero dentro de este contexto acotado (justo antes de
# dias/semanas/meses, ver los 3 regex de abajo) - nunca como reemplazo global en todo
# el texto, donde "un TV" (articulo, no numero) se corromperia a "1 TV".
_NUMBER_WORDS = {
    "un": 1,
    "una": 1,
    "dos": 2,
    "tres": 3,
    "cuatro": 4,
    "cinco": 5,
    "seis": 6,
    "siete": 7,
    "ocho": 8,
    "nueve": 9,
    "diez": 10,
    "once": 11,
    "doce": 12,
}
_NUMBER_TOKEN = r"(?:\d+|" + "|".join(_NUMBER_WORDS) + r")"

_DAYS_RE = re.compile(rf"en\s+({_NUMBER_TOKEN})\s+d[ií]as?")
_WEEKS_RE = re.compile(rf"en\s+({_NUMBER_TOKEN})\s+semanas?")
_MONTHS_RE = re.compile(rf"(?:en|de\s+aqu[ií]\s+a|dentro\s+de)\s+({_NUMBER_TOKEN})\s+meses?")


def _to_int(raw: str) -> int:
    return int(raw) if raw.isdigit() else _NUMBER_WORDS[raw.lower()]
_LEAD_IN_PHRASES = (
    "quiero comprar",
    "necesito ahorrar para",
    "quiero ahorrar para",
    "voy a comprar",
    "ahorrar para",
)

_MONTH_NAMES = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}


@dataclass
class ParsedGoalEntities:
    title: str | None
    amount: float | None
    amount_is_monthly: bool
    currency: str
    target_date: date | None


def _add_months(base: date, months: int) -> date:
    month_index = base.month - 1 + months
    year = base.year + month_index // 12
    month = month_index % 12 + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _extract_target_date(text: str, today: date) -> date | None:
    lowered = text.lower()
    if match := _DAYS_RE.search(lowered):
        return today + timedelta(days=_to_int(match.group(1)))
    if match := _WEEKS_RE.search(lowered):
        return today + timedelta(weeks=_to_int(match.group(1)))
    if match := _MONTHS_RE.search(lowered):
        return _add_months(today, _to_int(match.group(1)))
    for name, month_num in _MONTH_NAMES.items():
        if f"para {name}" in lowered or f"en {name}" in lowered:
            year = today.year if month_num >= today.month else today.year + 1
            return date(year, month_num, 1)
    return None


def _extract_amount_and_monthly_flag(text: str) -> tuple[float | None, bool]:
    """A diferencia de entity_parser._extract_amount ("el primer numero gana", tunado
    para frases de transacciones donde el monto viene primero), acá se descarta
    explicitamente cualquier numero que sea la DURACION ("3" en "en 3 meses") - sin
    esto, una frase como "en 3 meses, debo reunir 300" tomaria 3 como el monto."""
    lowered = text.lower()
    is_monthly = any(marker in lowered for marker in _MONTHLY_MARKERS)

    for match in _AMOUNT_RE.finditer(text):
        tail = lowered[match.end() : match.end() + 12]
        if re.match(r"\s*(d[ií]as?|semanas?|meses?)\b", tail):
            continue
        raw = match.group(0)
        normalized = raw.replace(".", "").replace(",", ".") if ("," in raw or "." in raw) else raw
        try:
            return float(normalized), is_monthly
        except ValueError:
            continue
    return None, is_monthly


def _extract_title(text: str) -> str | None:
    lowered = text.lower()
    stripped = text
    for phrase in _LEAD_IN_PHRASES:
        idx = lowered.find(phrase)
        if idx != -1:
            stripped = text[idx + len(phrase) :]
            break

    cut = re.search(rf"\d|en\s+{_NUMBER_TOKEN}\s+(?:d[ií]as?|semanas?|meses?)|de\s+aqu[ií]|dentro\s+de", stripped, re.IGNORECASE)
    title = stripped[: cut.start()] if cut else stripped
    title = title.strip(" ,.")
    return title or None


def parse_goal_entities(text: str, default_currency: str, today: date | None = None) -> ParsedGoalEntities:
    today = today or date.today()
    amount, is_monthly = _extract_amount_and_monthly_flag(text)
    return ParsedGoalEntities(
        title=_extract_title(text),
        amount=amount,
        amount_is_monthly=is_monthly,
        currency=extract_currency(text, default_currency),
        target_date=_extract_target_date(text, today),
    )
