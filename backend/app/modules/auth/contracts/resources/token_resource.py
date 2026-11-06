from pydantic import BaseModel

from app.modules.auth.contracts.resources.user_resource import UserResource


class TokenResource(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResource
