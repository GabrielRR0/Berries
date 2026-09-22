import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.shared.column_types import UuidPk


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id: Mapped[UuidPk]
    # FK a currencies en vez de codigo libre - mismo criterio que el resto de la app.
    # Declarados inline (no via CurrencyFk de column_types.py) porque necesitan un
    # nombre de columna propio por par (base/quote), a diferencia del resto de los
    # modelos que solo tienen una moneda.
    base_currency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("currencies.id"), nullable=False, index=True
    )
    quote_currency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("currencies.id"), nullable=False, index=True
    )
    base_currency: Mapped["Currency"] = relationship("Currency", foreign_keys=[base_currency_id])
    quote_currency: Mapped["Currency"] = relationship("Currency", foreign_keys=[quote_currency_id])
    rate: Mapped[Decimal] = mapped_column(Numeric(24, 10), nullable=False)
    # Sin server_default a propósito: cache_refresh.py necesita fijar este valor en
    # Python (datetime.now(timezone.utc)) para comparar staleness de forma consistente,
    # en vez de depender de CURRENT_TIMESTAMP del dialecto (naive en sqlite).
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # De dónde salió este número (ej. "dolarapi-oficial", "open-exchange-rates",
    # "coingecko", "fallback-stale") - una tasa sin procedencia no es un dato
    # profesional, es un número suelto. Nullable: filas viejas anteriores a este campo
    # no tienen forma de saber retroactivamente de qué cliente salieron.
    source: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # True cuando esta fila NO salió de una lectura real de mercado en el momento -
    # reutiliza la última tasa real conocida (o, en el peor caso, el respaldo
    # hardcodeado) porque el proveedor falló. Nunca debe mezclarse sin marca con una
    # tasa real - ver venezuela_rate_client.py/cache_refresh.py.
    is_estimated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    # Solo poblado cuando esta fila viene de una transferencia entre wallets en
    # monedas distintas (ver transfer_service.py) - la tasa IMPLÍCITA real que el
    # usuario obtuvo ese día/hora (ej. cuántos bolívares le dieron por sus USDT),
    # source="user-transfer". Comparte el mismo transfer_id que las Transaction de
    # esa transferencia (no es FK a una tabla "transfers", esa entidad no existe -
    # mismo criterio que Transaction.transfer_id). Permite que update_transfer
    # actualice esta fila en vez de acumular una nueva cada vez que se corrige un
    # monto, y que delete_transaction la borre junto con el resto de la
    # transferencia en vez de dejar una tasa "huérfana" en el historial.
    transfer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
