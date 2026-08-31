import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.auth.user_model import User
from app.schemas.transactions.category_schemas import CategoryCreateRequest, CategoryResponse, Kind
from app.services.transactions.categories.category_service import (
    build_category_response,
    create_category,
    delete_category,
    get_hidden_category_ids,
    hide_category,
    list_categories_for_user,
    unhide_category,
)
from app.services.transactions.categories.errors import CategoryNotFoundError, CategoryPermissionError, CategoryValidationError

router = APIRouter()


@router.get("", response_model=list[CategoryResponse])
async def list_mine(
    kind: Kind | None = Query(default=None),
    # Solo la pantalla de Ajustes pide include_hidden=true (para poder restaurar una
    # categoría por defecto que el usuario ocultó antes) - CategoryField.vue (el
    # autocompletar de los formularios de movimiento) nunca lo manda.
    include_hidden: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CategoryResponse]:
    categories = list_categories_for_user(db, current_user.id, kind=kind, include_hidden=include_hidden)
    hidden_ids = get_hidden_category_ids(db, current_user.id) if include_hidden else frozenset()
    return [build_category_response(category, hidden_ids) for category in categories]


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create(
    payload: CategoryCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> CategoryResponse:
    try:
        category = create_category(db, current_user.id, payload.name, payload.kind)
    except CategoryValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return build_category_response(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    category_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    try:
        delete_category(db, current_user.id, category_id)
    except CategoryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CategoryPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/{category_id}/hide", status_code=status.HTTP_204_NO_CONTENT)
async def hide(
    category_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    try:
        hide_category(db, current_user.id, category_id)
    except CategoryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CategoryPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.delete("/{category_id}/hide", status_code=status.HTTP_204_NO_CONTENT)
async def unhide(
    category_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    unhide_category(db, current_user.id, category_id)
