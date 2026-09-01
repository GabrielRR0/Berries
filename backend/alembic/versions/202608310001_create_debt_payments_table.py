"""create debt_payments table

Revision ID: 202608310001
Revises: 202608300003
Create Date: 2026-08-31

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202608310001"
down_revision: Union[str, None] = "202608300003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "debt_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("debt_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("debts.id"), nullable=False),
        sa.Column("amount", sa.Text(), nullable=False),
        sa.Column("currency_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("currencies.id"), nullable=False),
        sa.Column("applied_amount", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.Date(), nullable=False),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("wallets.id"), nullable=True),
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("transactions.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_debt_payments_debt_id", "debt_payments", ["debt_id"])
    op.create_index("ix_debt_payments_currency_id", "debt_payments", ["currency_id"])
    op.create_index("ix_debt_payments_wallet_id", "debt_payments", ["wallet_id"])
    op.create_index("ix_debt_payments_transaction_id", "debt_payments", ["transaction_id"])


def downgrade() -> None:
    op.drop_table("debt_payments")
