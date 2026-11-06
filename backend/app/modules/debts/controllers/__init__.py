"""Controllers del módulo, en el orden en que se registran."""

from app.modules.debts.controllers.private.user import debt_payments_controller, debts_controller, installments_controller

debts_routers = [
    debts_controller.router,
    installments_controller.router,
    debt_payments_controller.router,
]
