import uuid

from fastapi import Query, status

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.categories import services
from app.modules.categories.contracts.dto import CreateCategoryDto
from app.modules.categories.contracts.enums import Kind
from app.modules.categories.contracts.resources import CategoryResource

router = auth_group()


@router.get("", response_model=list[CategoryResource])
async def list_mine(
    db: DbSession,
    user: CurrentUser,
    kind: Kind | None = Query(default=None),
    # Solo la pantalla de Ajustes pide include_hidden=true (para poder restaurar una
    # categoría por defecto que el usuario ocultó antes) - CategoryField.vue (el
    # autocompletar de los formularios de movimiento) nunca lo manda.
    include_hidden: bool = Query(default=False),
) -> list[CategoryResource]:
    return services.list_category_resources(db, user.id, kind=kind, include_hidden=include_hidden)


@router.post("", response_model=CategoryResource, status_code=status.HTTP_201_CREATED)
async def create(payload: CreateCategoryDto, db: DbSession, user: CurrentUser) -> CategoryResource:
    return services.build_category_response(services.create_category(db, user.id, payload.name, payload.kind))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(category_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    services.delete_category(db, user.id, category_id)


@router.post("/{category_id}/hide", status_code=status.HTTP_204_NO_CONTENT)
async def hide(category_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    services.hide_category(db, user.id, category_id)


@router.delete("/{category_id}/hide", status_code=status.HTTP_204_NO_CONTENT)
async def unhide(category_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    services.unhide_category(db, user.id, category_id)
