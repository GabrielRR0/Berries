"""add suggested_wallet_id to transaction_drafts

Revision ID: 202608280005
Revises: 202608280004
Create Date: 2026-08-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202608280005"
down_revision: Union[str, None] = "202608280004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table (no op.add_column suelto): agregar una columna CON foreign key
    # es, para SQLite, una ALTER de constraint - no soportada directo (ver el mismo
    # criterio en 202608220002_encrypt_financial_columns.py). El modo batch reconstruye
    # la tabla por detrás, funciona igual en Postgres.
    with op.batch_alter_table("transaction_drafts") as batch_op:
        batch_op.add_column(sa.Column("suggested_wallet_id", postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.create_foreign_key(
            "fk_transaction_drafts_suggested_wallet_id", "wallets", ["suggested_wallet_id"], ["id"]
        )
        batch_op.create_index("ix_transaction_drafts_suggested_wallet_id", ["suggested_wallet_id"])


def downgrade() -> None:
    with op.batch_alter_table("transaction_drafts") as batch_op:
        batch_op.drop_index("ix_transaction_drafts_suggested_wallet_id")
        batch_op.drop_constraint("fk_transaction_drafts_suggested_wallet_id", type_="foreignkey")
        batch_op.drop_column("suggested_wallet_id")
