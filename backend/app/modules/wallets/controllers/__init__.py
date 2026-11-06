"""Controllers del módulo, en el orden en que se registran: el que tiene `/{wallet_id}`
va último para que no tape a las rutas fijas."""

from app.modules.wallets.controllers.private.user import transfers_controller, wallets_controller

wallets_routers = [
    transfers_controller.router,
    wallets_controller.router,
]
