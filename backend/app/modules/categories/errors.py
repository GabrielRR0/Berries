from app.common.errors import DomainError


class CategoryNotFoundError(DomainError):
    status_code = 404


class CategoryValidationError(DomainError):
    status_code = 400


class CategoryPermissionError(DomainError):
    status_code = 409
