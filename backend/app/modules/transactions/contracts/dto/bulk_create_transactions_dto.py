from pydantic import BaseModel, Field

from app.modules.transactions.contracts.dto.create_transaction_dto import CreateTransactionDto


class BulkCreateTransactionsDto(BaseModel):
    # Registro desde una captura con varios movimientos: todo o nada.
    items: list[CreateTransactionDto] = Field(min_length=1, max_length=100)
