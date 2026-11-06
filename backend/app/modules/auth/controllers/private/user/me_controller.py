from fastapi import Request, status

from app.common.security import CurrentUser, auth_group, limiter
from app.database import DbSession
from app.modules.auth import services
from app.modules.auth.contracts.resources import UserResource

router = auth_group()


@router.get("/me", response_model=UserResource)
async def me(user: CurrentUser) -> UserResource:
    return UserResource.model_validate(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def delete_me(request: Request, user: CurrentUser, db: DbSession) -> None:
    services.delete_own_account(db, user)
