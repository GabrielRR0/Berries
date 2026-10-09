"""add screenshot fields to transaction_drafts (txn_type, occurred_at, fee, reference)

Revision ID: 202610090001
Revises: 202609210002
Create Date: 2026-10-09

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "202610090001"
down_revision: Union[str, None] = "202609210002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Todo aditivo y nullable - cero impacto en los borradores existentes (voz/OCR), que
    # seguiran con estas columnas en NULL. fee y reference son Text porque van
    # encriptadas (ver EncryptedDecimal/EncryptedString en app/core/encryption.py).
    with op.batch_alter_table("transaction_drafts") as batch_op:
        batch_op.add_column(sa.Column("txn_type", sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("fee", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("reference", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("transaction_drafts") as batch_op:
        batch_op.drop_column("reference")
        batch_op.drop_column("fee")
        batch_op.drop_column("occurred_at")
        batch_op.drop_column("txn_type")
