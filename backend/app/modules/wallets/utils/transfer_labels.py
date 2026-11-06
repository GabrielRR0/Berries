"""Categorías y textos fijos de las filas que crea una transferencia."""

TRANSFER_CATEGORY = "Transferencia"
FEE_CATEGORY = "Comisión"
TRANSFER_RATE_SOURCE = "user-transfer"


def with_note(description: str, note: str | None) -> str:
    return f"{description} · {note}" if note else description
