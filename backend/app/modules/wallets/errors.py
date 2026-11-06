from app.common.errors import DomainError


class WalletNotFoundError(DomainError):
    status_code = 404


class InsufficientBalanceError(DomainError):
    status_code = 400


class CurrencyMismatchError(DomainError):
    status_code = 400


class TransferNotFoundError(DomainError):
    status_code = 404
