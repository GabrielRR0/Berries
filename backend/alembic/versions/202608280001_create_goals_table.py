"""create goals table

Revision ID: 202608280001
Revises: 202608220002
Create Date: 2026-08-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202608280001"
down_revision: Union[str, None] = "202608220002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        # Text (no String/Numeric): columnas encriptadas ya desde esta primera
        # migracion - tabla nueva, sin necesidad de un retrofit en dos pasos como
        # tuvieron debts/installments (ver 202608220002_encrypt_financial_columns.py).
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("target_amount", sa.Text(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("total_saved", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])


def downgrade() -> None:
    op.drop_table("goals")
