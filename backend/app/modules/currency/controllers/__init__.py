"""Controllers del módulo. `currency_routers` cuelga de /currency y `cron_routers` de /cron."""

from app.modules.currency.controllers.private.user import currency_controller
from app.modules.currency.controllers.system import cron_controller

currency_routers = [
    currency_controller.router,
]

cron_routers = [
    cron_controller.router,
]
