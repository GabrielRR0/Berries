from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped

from app.core.database import Base
from app.models.shared.column_types import CategoryFk, CreatedAt, UserFk, UuidPk


class HiddenCategory(Base):
    """Una categoría por defecto (Category.user_id is None) que ESTE usuario decidió
    ocultar de sus sugerencias - no se puede borrar un default (es compartido por todos
    los usuarios), así que ocultar es la única forma de "quitarlo de en medio" sin
    afectar a nadie más. Una categoría propia del usuario no necesita esto: se borra
    directo (ver category_service.delete_category)."""

    __tablename__ = "hidden_categories"
    __table_args__ = (UniqueConstraint("user_id", "category_id", name="uq_hidden_categories_user_category"),)

    id: Mapped[UuidPk]
    user_id: Mapped[UserFk]
    category_id: Mapped[CategoryFk]
    created_at: Mapped[CreatedAt]
