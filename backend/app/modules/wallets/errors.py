class WalletNotFoundError(Exception):
    pass


class InsufficientBalanceError(Exception):
    pass


class CurrencyMismatchError(Exception):
    pass


class TransferNotFoundError(Exception):
    pass
