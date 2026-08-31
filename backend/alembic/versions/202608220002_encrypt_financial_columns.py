"""encrypt financial columns (wallets.balance, transactions.amount/category/
description, debts.total_amount/counterparty_name/description, installments.amount,
transaction_drafts.raw_input/parsed_amount/parsed_category/parsed_description)

Pedido explícito del usuario: ni un admin mirando la tabla directo debe poder ver
cuánto gastó/recibió un usuario ni su historial. Ver app/core/encryption.py -
EncryptedDecimal/EncryptedString guardan el valor como texto cifrado (Fernet), así que
las columnas ya no pueden seguir siendo Numeric/String de largo fijo: pasan a Text.

IMPORTANTE: esta migración NO re-encripta datos existentes (no tiene forma de saber
si lo que ya está en la columna es texto plano o no) - solo cambia el tipo de columna
para lo que se escriba de acá en adelante. Cualquier fila ya sembrada antes de esta
migración queda con datos en texto plano que, leídos a través del nuevo tipo
encriptado, van a fallar al desencriptar. En este proyecto (todavía sin usuarios
reales) la solución fue borrar y re-sembrar los datos demo después de aplicar esto.

Revision ID: 202608220002
Revises: 202608220001
Create Date: 2026-08-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "202608220002"
down_revision: Union[str, None] = "202608220001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("wallets") as batch_op:
        batch_op.alter_column("balance", existing_type=sa.Numeric(18, 2), type_=sa.Text(), server_default=None)

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.alter_column("amount", existing_type=sa.Numeric(18, 2), type_=sa.Text())
        batch_op.alter_column("category", existing_type=sa.String(length=80), type_=sa.Text())
        batch_op.alter_column("description", existing_type=sa.Text(), type_=sa.Text())

    with op.batch_alter_table("debts") as batch_op:
        batch_op.alter_column("counterparty_name", existing_type=sa.String(length=120), type_=sa.Text())
        batch_op.alter_column("total_amount", existing_type=sa.Numeric(18, 2), type_=sa.Text())
        batch_op.alter_column("description", existing_type=sa.String(), type_=sa.Text())

    with op.batch_alter_table("installments") as batch_op:
        batch_op.alter_column("amount", existing_type=sa.Numeric(18, 2), type_=sa.Text())

    with op.batch_alter_table("transaction_drafts") as batch_op:
        batch_op.alter_column("raw_input", existing_type=sa.Text(), type_=sa.Text())
        batch_op.alter_column("parsed_amount", existing_type=sa.Numeric(18, 2), type_=sa.Text())
        batch_op.alter_column("parsed_category", existing_type=sa.String(length=80), type_=sa.Text())
        batch_op.alter_column("parsed_description", existing_type=sa.Text(), type_=sa.Text())


def downgrade() -> None:
    with op.batch_alter_table("transaction_drafts") as batch_op:
        batch_op.alter_column("parsed_description", existing_type=sa.Text(), type_=sa.Text())
        batch_op.alter_column("parsed_category", existing_type=sa.Text(), type_=sa.String(length=80))
        batch_op.alter_column("parsed_amount", existing_type=sa.Text(), type_=sa.Numeric(18, 2))
        batch_op.alter_column("raw_input", existing_type=sa.Text(), type_=sa.Text())

    with op.batch_alter_table("installments") as batch_op:
        batch_op.alter_column("amount", existing_type=sa.Text(), type_=sa.Numeric(18, 2))

    with op.batch_alter_table("debts") as batch_op:
        batch_op.alter_column("description", existing_type=sa.Text(), type_=sa.String())
        batch_op.alter_column("total_amount", existing_type=sa.Text(), type_=sa.Numeric(18, 2))
        batch_op.alter_column("counterparty_name", existing_type=sa.Text(), type_=sa.String(length=120))

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.alter_column("description", existing_type=sa.Text(), type_=sa.Text())
        batch_op.alter_column("category", existing_type=sa.Text(), type_=sa.String(length=80))
        batch_op.alter_column("amount", existing_type=sa.Text(), type_=sa.Numeric(18, 2))

    with op.batch_alter_table("wallets") as batch_op:
        batch_op.alter_column("balance", existing_type=sa.Text(), type_=sa.Numeric(18, 2), server_default="0")
