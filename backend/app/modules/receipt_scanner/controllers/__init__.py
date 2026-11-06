"""Controllers del módulo, en el orden en que se registran."""

from app.modules.receipt_scanner.controllers.private.user import receipt_scanner_controller

receipt_scanner_routers = [
    receipt_scanner_controller.router,
]
