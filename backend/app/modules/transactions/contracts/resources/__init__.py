"""Lo que SALE por HTTP: un modelo por respuesta."""

from app.modules.transactions.contracts.resources.draft_resource import DraftResource
from app.modules.transactions.contracts.resources.duplicate_check_resource import DuplicateCheckResource
from app.modules.transactions.contracts.resources.transaction_resource import TransactionResource

__all__ = [
    "DraftResource",
    "DuplicateCheckResource",
    "TransactionResource",
]
