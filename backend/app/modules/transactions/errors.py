from app.common.errors import DomainError


class TransactionValidationError(DomainError):
    status_code = 400


class TransactionNotFoundError(TransactionValidationError):
    """Solo al borrar: crear o editar un movimiento ajeno sigue respondiendo 400 (así
    funcionaba antes de tener errores con código propio)."""

    status_code = 404


class DraftNotFoundError(DomainError):
    status_code = 404
