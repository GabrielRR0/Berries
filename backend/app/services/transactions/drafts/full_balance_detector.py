"""Detecta si un dictado dice haber gastado TODO el saldo de una wallet real del
usuario (pedido explicito: "he gastado todo lo que tenía en mi cuenta de Binance/
Facebank/cuenta de Venezuela"). A diferencia de personal_vocabulary.py (que corrige
UNA palabra mal transcrita contra el vocabulario del usuario), acá se busca una
REFERENCIA a una wallet en cualquier parte de una oración más larga - un nombre de
wallet puede ser multi-palabra ("Banco de Venezuela") y el usuario puede parafrasearlo
("mi cuenta de Venezuela"), así que se compara por palabras significativas del nombre
(>=4 letras) en vez de por el nombre completo exacto.

Si matchea, el llamador (voice_entry_service.py) reemplaza el monto/moneda parseados
por el balance/moneda reales de esa wallet - no tiene sentido "adivinar" un monto del
texto cuando el usuario ya dijo exactamente cuál es (todo lo que tenía)."""

import re

from app.models.wallets.wallet_model import Wallet

_FULL_BALANCE_PHRASES = (
    "gasté todo",
    "gaste todo",
    "usé todo",
    "use todo",
    "se fue todo",
    "no me quedó nada",
    "no me quedo nada",
    "vacié",
    "vacie",
    "todo lo que tenía",
    "todo lo que tenia",
    "todo el saldo",
    "todo el dinero",
)

_WORD_RE = re.compile(r"[a-záéíóúñ]+")
_MIN_WORD_LEN = 4  # evita matchear por palabras cortas/comunes ("de", "la", "banco")


def _significant_words(name: str) -> set[str]:
    words = _WORD_RE.findall(name.lower())
    if len(words) <= 1:
        return set(words)  # nombre corto de una sola palabra ("Nu", "BoA") - se usa tal cual
    long_words = {word for word in words if len(word) >= _MIN_WORD_LEN}
    return long_words or set(words)  # si TODAS las palabras son cortas, no se descarta nada


def detect_full_balance_wallet(text: str, wallets: list[Wallet]) -> Wallet | None:
    """Devuelve la wallet mencionada si el texto tiene una frase de "gasté todo" Y
    exactamente UNA wallet del usuario tiene una palabra significativa de su nombre
    presente en el texto. Ambiguo (0 o 2+ matches) devuelve None - nunca se adivina."""
    lowered = text.lower()
    if not any(phrase in lowered for phrase in _FULL_BALANCE_PHRASES):
        return None

    text_words = set(_WORD_RE.findall(lowered))
    matches = [wallet for wallet in wallets if _significant_words(wallet.name) & text_words]
    return matches[0] if len(matches) == 1 else None
