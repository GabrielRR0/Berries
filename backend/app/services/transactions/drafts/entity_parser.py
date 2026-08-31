"""Parser de monto/moneda/categoría en texto libre (español), compartido a futuro por
voiceEntry y receiptScanner. A diferencia de los clientes de APIs externas del proyecto,
esto SÍ es lógica completamente funcional hoy — heurísticas de regex/keywords, sin
llamadas externas."""

import re
from dataclasses import dataclass

from app.services.transactions.drafts.category_keywords import DEFAULT_CATEGORY_KEYWORDS

_NUMBER_RE = re.compile(r"\d[\d.,]*\d|\d")

_CURRENCY_KEYWORDS: list[tuple[tuple[str, ...], str]] = [
    # USDT antes que USD: "usdt" contiene "usd" como substring, así que si USD se
    # revisara primero, un texto con "USDT" siempre resolvería (mal) a "USD".
    (("usdt", "tether"), "USDT"),
    (("dólares", "dolares", "usd", "$"), "USD"),
    (("bolívares", "bolivares", "bs", "vef"), "VEF"),
    (("euros", "eur", "€"), "EUR"),
    # "pesos" a secas es ambiguo (colombianos/argentinos/otros) - a proposito NO se
    # mapea solo, requiere el gentilicio o el código para desambiguar.
    (("pesos colombianos", "cop"), "COP"),
    (("pesos argentinos", "ars"), "ARS"),
]


@dataclass
class ParsedEntities:
    amount: float | None
    currency: str
    category: str | None
    description: str


def _extract_amount(text: str) -> float | None:
    match = _NUMBER_RE.search(text)
    if match is None:
        return None

    raw = match.group(0)
    has_dot = "." in raw
    has_comma = "," in raw

    if has_dot and has_comma:
        # El separador que aparece último en el string es el decimal; el otro es de miles
        # (cubre tanto "1.234,56" como "1,234.56" sin necesitar saber el locale de origen).
        if raw.rfind(",") > raw.rfind("."):
            decimal_sep, thousands_sep = ",", "."
        else:
            decimal_sep, thousands_sep = ".", ","
        normalized = raw.replace(thousands_sep, "").replace(decimal_sep, ".")
    elif has_comma or has_dot:
        sep = "," if has_comma else "."
        tail = raw.split(sep)[-1]
        # Un solo separador seguido de exactamente 2 dígitos: se asume decimal ("15,50").
        # Cualquier otro caso (varias apariciones, o 1/3/4+ dígitos de cola): de miles.
        if raw.count(sep) == 1 and len(tail) == 2:
            normalized = raw.replace(sep, ".")
        else:
            normalized = raw.replace(sep, "")
    else:
        normalized = raw

    try:
        return float(normalized)
    except ValueError:
        return None


def extract_currency(text: str, default_currency: str) -> str:
    lowered = text.lower()
    for keywords, code in _CURRENCY_KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return code
    return default_currency


def _extract_category(text: str) -> str | None:
    lowered = text.lower()
    for category, keywords in DEFAULT_CATEGORY_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return category
    return None


def parse_transaction_entities(text: str, default_currency: str = "USD") -> ParsedEntities:
    return ParsedEntities(
        amount=_extract_amount(text),
        currency=extract_currency(text, default_currency),
        category=_extract_category(text),
        description=text.strip(),
    )
