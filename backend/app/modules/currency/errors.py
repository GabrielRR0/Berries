from app.common.errors import DomainError


class UnsupportedCurrencyError(DomainError):
    status_code = 400
