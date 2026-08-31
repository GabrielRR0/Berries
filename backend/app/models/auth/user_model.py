from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.shared.column_types import CreatedAt, CurrencyFk, UuidPk


class User(Base):
    __tablename__ = "users"

    id: Mapped[UuidPk]
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # password_hash sigue NOT NULL incluso para una cuenta creada por Google - se llena
    # con el hash de un valor aleatorio que nadie conoce (mismo criterio que el usuario
    # demo en demo_seed_service.py), así que ese login por password simplemente nunca
    # puede tener éxito. Evita volver nullable una columna que todo el resto del código
    # ya asume presente, a cambio de una fila más simple.
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Identificador estable de Google ("sub" del ID token) para una cuenta creada o
    # vinculada por "Iniciar sesión con Google" - ver app/shared/google_auth.py. Único
    # cuando no es NULL (no puede haber dos filas con el mismo sub), pero la mayoría de
    # las cuentas (registro con email/clave) lo dejan NULL.
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    # Moneda de visualización por defecto - FK a currencies (ver Currency), pedido
    # explicito del usuario de restringir esto a la lista de monedas soportadas en vez
    # de texto libre. Sin default de Python: register_user() la resuelve buscando el
    # código "USD" en la tabla, no hay forma de hardcodear un UUID acá. "default_
    # currency" como @property (mismo criterio que Wallet.currency) para que
    # AuthResponse/UserResponse (model_validate, from_attributes=True) sigan leyendo
    # un string ahí sin tocar el schema.
    default_currency_id: Mapped[CurrencyFk]
    default_currency_ref: Mapped["Currency"] = relationship("Currency")

    @property
    def default_currency(self) -> str:
        return self.default_currency_ref.code

    created_at: Mapped[CreatedAt]
