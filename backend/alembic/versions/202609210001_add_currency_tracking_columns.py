"""add currency tracking columns (transactions.currency_id/reference_rate, exchange_rates.source/is_estimated)

Revision ID: 202609210001
Revises: 202609040001
Create Date: 2026-09-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202609210001"
down_revision: Union[str, None] = "202609040001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Todo aditivo y nullable/con default - cero impacto en filas existentes hasta que
    # el código empiece a leer estas columnas (ver plan de arreglo de sumas de moneda,
    # sección "Qué pasa con los usuarios/datos que ya existen en producción").
    #
    # transactions.currency_id: snapshot de wallet.currency_id al crear/editar - un
    # asiento ya ocurrido debe bastarse a sí mismo para saber en qué moneda estaba (ver
    # transaction_model.py). batch_alter_table por la FK, mismo criterio que
    # 202609040001_add_wallet_id_to_goal_check_ins.py (SQLite no soporta agregar una FK
    # con un ALTER suelto).
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(sa.Column("currency_id", postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.create_foreign_key("fk_transactions_currency_id", "currencies", ["currency_id"], ["id"])
        batch_op.create_index("ix_transactions_currency_id", ["currency_id"])
        # Text (no Numeric) - encriptada, mismo criterio que reference_amount_usd (ver
        # EncryptedDecimal en app/core/encryption.py).
        batch_op.add_column(sa.Column("reference_rate", sa.Text(), nullable=True))

    # exchange_rates.source/is_estimated: procedencia y confiabilidad de cada tasa -
    # una tasa sin esto no es un dato profesional, es un número suelto (ver
    # currency_service.py/cache_refresh.py). is_estimated con server_default para que
    # las filas viejas (todas reales, previas a este campo) queden en False, no NULL.
    with op.batch_alter_table("exchange_rates") as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(length=40), nullable=True))
        batch_op.add_column(
            sa.Column("is_estimated", sa.Boolean(), nullable=False, server_default=sa.false())
        )


def downgrade() -> None:
    with op.batch_alter_table("exchange_rates") as batch_op:
        batch_op.drop_column("is_estimated")
        batch_op.drop_column("source")

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_column("reference_rate")
        batch_op.drop_index("ix_transactions_currency_id")
        batch_op.drop_constraint("fk_transactions_currency_id", type_="foreignkey")
        batch_op.drop_column("currency_id")
