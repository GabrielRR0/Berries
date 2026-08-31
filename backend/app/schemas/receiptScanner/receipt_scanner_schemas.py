# El escaneo de recibos produce el mismo tipo de fila (TransactionDraft) que ya modela
# app.schemas.transactions.transaction_schemas.DraftResponse — se reimporta acá en vez
# de redefinir un schema idéntico, así el router de receiptScanner no necesita conocer
# el módulo de transactions directamente.
from app.schemas.transactions.transaction_schemas import DraftResponse

__all__ = ["DraftResponse"]
