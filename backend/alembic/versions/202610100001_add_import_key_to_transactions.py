"""add import_key to transactions

Revision ID: 202610100001
Revises: 202610090001
Create Date: 2026-10-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "202610100001"
down_revision: Union[str, None] = "202610090001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Aditiva y nullable - cero impacto en los movimientos existentes (quedan en NULL).
    # Guarda un identificador opaco (HMAC, ver import_key.py) de los movimientos que vienen
    # de una captura, para detectar que ya se registraron. Con indice porque se consulta por
    # igualdad al revisar un lote.
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(sa.Column("import_key", sa.String(length=64), nullable=True))
        batch_op.create_index("ix_transactions_import_key", ["import_key"])


def downgrade() -> None:
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_index("ix_transactions_import_key")
        batch_op.drop_column("import_key")
