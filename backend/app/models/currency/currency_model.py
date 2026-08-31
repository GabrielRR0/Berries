from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.shared.column_types import UuidPk


class Currency(Base):
    """Catálogo fijo de monedas que la app ofrece (ver frontend/src/utils/currency/
    supportedCurrencies.ts, misma lista). SIN encriptar: nombre/símbolo/locale son
    datos de catálogo, no financieros de un usuario - mismo criterio que Category."""

    __tablename__ = "currencies"

    id: Mapped[UuidPk]
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    # Locale usado solo para el formato de agrupacion/decimales al mostrar montos
    # (Intl.NumberFormat en el frontend) - no determina el idioma de la UI.
    locale: Mapped[str] = mapped_column(String(10), nullable=False)
