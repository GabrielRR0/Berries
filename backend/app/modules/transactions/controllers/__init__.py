"""Controllers del módulo, en el orden en que se registran: los borradores (/drafts/...)
van antes que los movimientos, que tienen `/{transaction_id}`."""

from app.modules.transactions.controllers.private.user import drafts_controller, transactions_controller

transactions_routers = [
    drafts_controller.router,
    transactions_controller.router,
]
