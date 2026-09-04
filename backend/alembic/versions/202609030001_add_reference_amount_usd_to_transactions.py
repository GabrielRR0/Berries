"""add reference_amount_usd to transactions

Revision ID: 202609030001
Revises: 202608310001
Create Date: 2026-09-03

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "202609030001"
down_revision: Union[str, None] = "202608310001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Text (no Numeric) - columna encriptada, mismo tipo subyacente que "amount" (ver
    # EncryptedDecimal en app/core/encryption.py). Nullable: NULL significa "la wallet ya
    # estaba en USD, no hace falta un valor de referencia" (ver create_transaction) - las
    # filas existentes también quedan en NULL, no se backfillea automáticamente.
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(sa.Column("reference_amount_usd", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_column("reference_amount_usd")
