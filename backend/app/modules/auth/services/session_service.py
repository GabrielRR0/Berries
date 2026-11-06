"""La respuesta de sesión que devuelven registro y login: token + datos del usuario."""

from app.common.security import create_access_token
from app.modules.auth.contracts.resources import TokenResource, UserResource
from app.modules.auth.models import User


def issue_session(user: User) -> TokenResource:
    token = create_access_token(subject=str(user.id))
    return TokenResource(access_token=token, user=UserResource.model_validate(user))
