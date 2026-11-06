from app.common.errors import DomainError


class InvalidPeriodError(DomainError):
    """El string de período recibido no tiene el formato 'YYYY-MM' esperado."""

    status_code = 422
