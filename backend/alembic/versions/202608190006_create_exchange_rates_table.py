"""create exchange_rates table

Revision ID: 202608190006
Revises: 202608190005
Create Date: 2026-08-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202608190006"
down_revision: Union[str, None] = "202608190005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "exchange_rates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("base_currency", sa.String(length=10), nullable=False),
        sa.Column("quote_currency", sa.String(length=10), nullable=False),
        sa.Column("rate", sa.Numeric(24, 10), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_exchange_rates_base_currency", "exchange_rates", ["base_currency"])
    op.create_index("ix_exchange_rates_quote_currency", "exchange_rates", ["quote_currency"])


def downgrade() -> None:
    op.drop_table("exchange_rates")
