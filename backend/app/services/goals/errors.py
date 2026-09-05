class GoalNotFoundError(Exception):
    pass


class GoalValidationError(Exception):
    pass


class GoalNotActiveError(Exception):
    pass


class InsufficientAvailableBalanceError(Exception):
    pass
