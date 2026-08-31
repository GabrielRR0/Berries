"""add transfer_id to transactions

Revision ID: 202608220001
Revises: 202608190008
Create Date: 2026-08-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202608220001"
down_revision: Union[str, None] = "202608190008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("transfer_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_transactions_transfer_id", "transactions", ["transfer_id"])


def downgrade() -> None:
    op.drop_index("ix_transactions_transfer_id", table_name="transactions")
    op.drop_column("transactions", "transfer_id")
