from app.common.errors import DomainError


class DebtNotFoundError(DomainError):
    status_code = 404


class DebtValidationError(DomainError):
    status_code = 400


class InstallmentAlreadyPaidError(DomainError):
    status_code = 409
