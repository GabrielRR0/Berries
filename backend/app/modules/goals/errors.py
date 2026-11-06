from app.common.errors import DomainError


class GoalNotFoundError(DomainError):
    status_code = 404


class GoalValidationError(DomainError):
    status_code = 400


class GoalNotActiveError(DomainError):
    status_code = 409


class InsufficientAvailableBalanceError(DomainError):
    status_code = 400
