import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transactions.category_model import Category
from app.models.transactions.hidden_category_model import HiddenCategory
from app.schemas.transactions.category_schemas import CategoryResponse, Kind
from app.services.transactions.categories.errors import CategoryNotFoundError, CategoryPermissionError, CategoryValidationError

_VALID_KINDS = ("income", "expense", "both")


def get_hidden_category_ids(db: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    return set(db.scalars(select(HiddenCategory.category_id).where(HiddenCategory.user_id == user_id)))


def list_categories_for_user(
    db: Session, user_id: uuid.UUID, kind: Kind | None = None, include_hidden: bool = False
) -> list[Category]:
    """Categorías visibles para este usuario: todas las por defecto (user_id is None)
    mas las propias que se creo. Por defecto EXCLUYE las que este usuario ocultó -
    `include_hidden=True` las trae igual (solo lo usa la pantalla de Ajustes, para
    poder mostrarlas con opción de "restaurar", ver categories_router.py). `kind`
    filtra por tipo exacto o "both" (una categoría "both" sirve tanto para ingresos
    como gastos, ver category_model.py)."""
    stmt = select(Category)
    if include_hidden:
        stmt = stmt.where((Category.user_id.is_(None)) | (Category.user_id == user_id))
    else:
        hidden_ids = select(HiddenCategory.category_id).where(HiddenCategory.user_id == user_id)
        stmt = stmt.where(
            ((Category.user_id.is_(None)) & (Category.id.notin_(hidden_ids))) | (Category.user_id == user_id)
        )
    if kind is not None:
        stmt = stmt.where((Category.kind == kind) | (Category.kind == "both"))
    stmt = stmt.order_by(Category.name)
    return list(db.scalars(stmt).all())


def create_category(db: Session, user_id: uuid.UUID, name: str, kind: Kind) -> Category:
    name = name.strip()
    if not name:
        raise CategoryValidationError("El nombre no puede estar vacío")
    if kind not in _VALID_KINDS:
        raise CategoryValidationError("kind debe ser 'income', 'expense' o 'both'")

    category = Category(user_id=user_id, name=name, kind=kind)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def _get_category(db: Session, category_id: uuid.UUID) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise CategoryNotFoundError("Categoría no encontrada")
    return category


def delete_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    category = _get_category(db, category_id)
    if category.user_id is None:
        raise CategoryPermissionError("No se puede eliminar una categoría por defecto, se puede ocultar en su lugar")
    if category.user_id != user_id:
        raise CategoryNotFoundError("Categoría no encontrada")
    db.delete(category)
    db.commit()


def hide_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    category = _get_category(db, category_id)
    if category.user_id is not None:
        raise CategoryPermissionError("Solo se pueden ocultar categorías por defecto - una propia se elimina en su lugar")

    already_hidden = db.scalar(
        select(HiddenCategory).where(HiddenCategory.user_id == user_id, HiddenCategory.category_id == category_id)
    )
    if already_hidden is not None:
        return  # idempotente: ocultar dos veces la misma categoría no es un error

    db.add(HiddenCategory(user_id=user_id, category_id=category_id))
    db.commit()


def unhide_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    hidden = db.scalar(
        select(HiddenCategory).where(HiddenCategory.user_id == user_id, HiddenCategory.category_id == category_id)
    )
    if hidden is not None:
        db.delete(hidden)
        db.commit()


def build_category_response(category: Category, hidden_ids: frozenset[uuid.UUID] = frozenset()) -> CategoryResponse:
    return CategoryResponse(
        id=category.id,
        name=category.name,
        kind=category.kind,
        is_default=category.user_id is None,
        is_hidden=category.id in hidden_ids,
    )
