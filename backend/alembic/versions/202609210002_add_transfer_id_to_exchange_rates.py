"""add transfer_id to exchange_rates

Revision ID: 202609210002
Revises: 202609210001
Create Date: 2026-09-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202609210002"
down_revision: Union[str, None] = "202609210001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Aditiva y nullable - vincula una fila de ExchangeRate a la transferencia que la
    # generó (ver transfer_service.py), para poder actualizarla/borrarla junto con esa
    # transferencia en vez de acumular observaciones huérfanas. Cero impacto en filas
    # existentes (todas seguirán con transfer_id NULL - vinieron de un fetch de API,
    # no de una transferencia).
    with op.batch_alter_table("exchange_rates") as batch_op:
        batch_op.add_column(sa.Column("transfer_id", postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.create_index("ix_exchange_rates_transfer_id", ["transfer_id"])


def downgrade() -> None:
    with op.batch_alter_table("exchange_rates") as batch_op:
        batch_op.drop_index("ix_exchange_rates_transfer_id")
        batch_op.drop_column("transfer_id")
