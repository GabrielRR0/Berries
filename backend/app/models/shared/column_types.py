"""Alias de columnas reutilizables, para que cada modelo declare sus campos como una
sola línea "nombre: Mapped[Tipo]" en vez de repetir `mapped_column(UUID(...), ...)` en
cada archivo — el equivalente más cercano en SQLAlchemy a lo declarativo/corto de un
modelo de Laravel (ahí el detalle de columna vive en la migración; acá vive una sola
vez acá y el modelo solo referencia el alias).

Usar como `id: Mapped[UuidPk]` (sin `= mapped_column(...)` — el tipo ya lo trae).
Un campo que no encaja con ninguno de estos alias (nombre, monto con precisión
distinta, status como string libre, etc.) se sigue declarando explícito e inline como
hasta ahora — estos alias son solo para lo que se repite igual en varios modelos.
"""

import uuid
from datetime import datetime
from typing import Annotated

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import mapped_column

UuidPk = Annotated[uuid.UUID, mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)]

CreatedAt = Annotated[datetime, mapped_column(DateTime(timezone=True), server_default=func.now())]

UserFk = Annotated[uuid.UUID, mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)]

NullableUserFk = Annotated[
    uuid.UUID | None, mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
]

WalletFk = Annotated[
    uuid.UUID, mapped_column(UUID(as_uuid=True), ForeignKey("wallets.id"), nullable=False, index=True)
]

NullableWalletFk = Annotated[
    uuid.UUID | None, mapped_column(UUID(as_uuid=True), ForeignKey("wallets.id"), nullable=True, index=True)
]

DebtFk = Annotated[uuid.UUID, mapped_column(UUID(as_uuid=True), ForeignKey("debts.id"), nullable=False, index=True)]

GoalFk = Annotated[uuid.UUID, mapped_column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False, index=True)]

CategoryFk = Annotated[
    uuid.UUID, mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False, index=True)
]

CurrencyFk = Annotated[
    uuid.UUID, mapped_column(UUID(as_uuid=True), ForeignKey("currencies.id"), nullable=False, index=True)
]

NullableCurrencyFk = Annotated[
    uuid.UUID | None, mapped_column(UUID(as_uuid=True), ForeignKey("currencies.id"), nullable=True, index=True)
]
