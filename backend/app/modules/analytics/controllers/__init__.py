"""Controllers del módulo, en el orden en que se registran."""

from app.modules.analytics.controllers.private.user import analytics_controller

analytics_routers = [
    analytics_controller.router,
]
