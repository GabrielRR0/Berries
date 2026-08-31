import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric
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
