"""create transaction_drafts table

Revision ID: 202608190005
Revises: 202608190004
Create Date: 2026-08-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202608190005"
down_revision: Union[str, None] = "202608190004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "transaction_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source", sa.String(length=10), nullable=False),
        sa.Column("raw_input", sa.Text(), nullable=True),
        sa.Column("parsed_amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("parsed_currency", sa.String(length=10), nullable=True),
        sa.Column("parsed_category", sa.String(length=80), nullable=True),
        sa.Column("parsed_description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_transaction_drafts_user_id", "transaction_drafts", ["user_id"])


def downgrade() -> None:
    op.drop_table("transaction_drafts")
