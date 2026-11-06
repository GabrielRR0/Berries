from app.common.errors import DomainError


class OcrNotConfiguredError(DomainError):
    status_code = 503
