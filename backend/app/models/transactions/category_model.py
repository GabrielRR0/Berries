from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.shared.column_types import NullableUserFk, UuidPk


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[UuidPk]
    # None => categoría compartida por defecto; no-None => categoría custom de ese usuario.
    user_id: Mapped[NullableUserFk]
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # "income" | "expense" | "both"
