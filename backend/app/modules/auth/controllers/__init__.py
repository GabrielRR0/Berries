"""Controllers del módulo, en el orden en que se registran."""

from app.modules.auth.controllers.private.user import me_controller
from app.modules.auth.controllers.anonymous import auth_controller

auth_routers = [
    auth_controller.router,
    me_controller.router,
]
