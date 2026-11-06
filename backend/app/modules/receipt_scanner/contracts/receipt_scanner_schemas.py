# El escaneo de recibos produce el mismo tipo de fila (TransactionDraft) que ya modela
# app.modules.transactions.contracts.transaction_schemas.DraftResponse — se reimporta acá en vez
# de redefinir un schema idéntico, así el router de receiptScanner no necesita conocer
# el módulo de transactions directamente.
from app.modules.transactions import DraftResponse

__all__ = ["DraftResponse"]
