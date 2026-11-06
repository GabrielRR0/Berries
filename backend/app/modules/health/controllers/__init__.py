"""Controllers del módulo, en el orden en que se registran."""

from app.modules.health.controllers.anonymous import health_controller

health_routers = [
    health_controller.router,
]
