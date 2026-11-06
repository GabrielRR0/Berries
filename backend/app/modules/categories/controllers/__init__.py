"""Controllers del módulo, en el orden en que se registran."""

from app.modules.categories.controllers.private.user import categories_controller

categories_routers = [
    categories_controller.router,
]
