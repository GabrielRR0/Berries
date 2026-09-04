import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encryption import EncryptedDecimal, EncryptedString
from app.models.shared.column_types import CreatedAt, UserFk, UuidPk, WalletFk


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[UuidPk]
    user_id: Mapped[UserFk]
    wallet_id: Mapped[WalletFk]
    # "income" | "expense" — validado en el schema Pydantic, no enum de Postgres. SIN
    # encriptar a proposito: se usa en filtros WHERE (ver transaction_service.py,
    # analytics_service.py) y solo tiene 2 valores fijos, no revela nada del "cuanto/
    # que/por que" que pidio proteger el usuario.
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    # Encriptados (ver app/core/encryption.py) - pedido explicito del usuario: ni un
    # admin mirando la tabla directo debe poder ver cuanto gasto/recibio un usuario ni
    # en que. Como el ciphertext no es comparable/agregable en SQL, el filtro por
    # categoria y las sumas de analytics_service.py ahora se resuelven en Python sobre
    # las filas ya traidas (occurred_at/type/wallet_id siguen sin encriptar justamente
    # para poder seguir filtrando esos por SQL).
    amount: Mapped[Decimal] = mapped_column(EncryptedDecimal, nullable=False)
    # Valor congelado en USD al momento de crear la transacción (ver create_transaction)
    # - pedido explícito del usuario: para una wallet en una moneda nacional con
    # inflación fuerte (VEF, COP, ARS...), quiere un registro FIJO de "cuánto era eso
    # ese día", que nunca cambie aunque la tasa de cambio se siga moviendo después (a
    # diferencia de get_conversion_rate_at en analytics_service.py, que recalcula la
    # conversión en cada consulta - útil para resúmenes, pero no es un registro
    # inmutable). NULL cuando la wallet ya estaba en USD (el propio "amount" ya es la
    # referencia, guardar el mismo valor dos veces no aporta nada).
    reference_amount_usd: Mapped[Decimal | None] = mapped_column(EncryptedDecimal, nullable=True)
    category: Mapped[str] = mapped_column(EncryptedString, nullable=False)
    description: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    # Cuándo ocurrió la transacción (settable por el usuario), no cuándo se registró.
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # "manual" ahora, o "voice"/"ocr"/"transfer" segun el origen.
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    # Comparte el mismo valor entre las DOS transacciones (expense+income) que crea una
    # transferencia entre wallets propias (ver transfer_service.py) - no es FK a una
    # tabla "transfers" (esa entidad no existe, es solo la clave que une ambas patas).
    # None para cualquier transaction que no venga de una transferencia.
    transfer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    created_at: Mapped[CreatedAt]
