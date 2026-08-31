from decimal import Decimal

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.encryption import EncryptedDecimal, EncryptedString
from app.models.shared.column_types import CreatedAt, NullableCurrencyFk, NullableWalletFk, UserFk, UuidPk


class TransactionDraft(Base):
    """Borrador pendiente de revisión, generado por voiceEntry/receiptScanner (a futuro)
    antes de confirmarse como una Transaction real."""

    __tablename__ = "transaction_drafts"

    id: Mapped[UuidPk]
    user_id: Mapped[UserFk]
    source: Mapped[str] = mapped_column(String(10), nullable=False)  # "voice" | "ocr"
    # Encriptados (ver app/core/encryption.py) - raw_input es literalmente lo que el
    # usuario dijo/escaneó sobre un movimiento suyo ("gasté 20 dólares en comida"), y
    # los parsed_* son el mismo dato ya estructurado - mismo criterio que Transaction.
    raw_input: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    parsed_amount: Mapped[Decimal | None] = mapped_column(EncryptedDecimal, nullable=True)
    # FK a currencies (nullable: un borrador puede no tener moneda detectada todavia).
    # "parsed_currency" como @property (mismo criterio que Wallet.currency) para que
    # DraftResponse.model_validate(draft) siga leyendo un string|None ahí.
    parsed_currency_id: Mapped[NullableCurrencyFk]
    parsed_currency_ref: Mapped["Currency | None"] = relationship("Currency")

    @property
    def parsed_currency(self) -> str | None:
        return self.parsed_currency_ref.code if self.parsed_currency_ref else None

    parsed_category: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    parsed_description: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    # Poblado solo cuando el dictado menciona una wallet real del usuario junto con una
    # frase de "usé todo el saldo" (ver full_balance_detector.py) - en ese caso
    # parsed_amount/parsed_currency ya vienen sobreescritos con el balance real de esta
    # wallet, y DraftReviewCard.vue la preselecciona en vez de inferir por moneda.
    suggested_wallet_id: Mapped[NullableWalletFk]
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|confirmed|discarded
    created_at: Mapped[CreatedAt]
