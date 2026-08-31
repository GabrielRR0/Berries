"""convert currency columns to fk (wallets.currency, debts.currency, goals.currency,
users.default_currency, transaction_drafts.parsed_currency,
exchange_rates.base_currency/quote_currency)

Pedido explícito del usuario: las tablas que referencian una moneda deben guardar un id
(FK a currencies) en vez de repetir el código como string libre en cada fila - evita
typos y monedas inconsistentes entre sí, y centraliza nombre/símbolo/locale en un solo
lugar (ver Currency).

Cada columna sigue el mismo patrón en 3 pasos (agregar nullable -> rellenar por código
-> volver NOT NULL + FK + borrar la columna vieja) en vez de un solo batch_alter_table,
porque el modo batch de SQLite reconstruye la tabla recién al salir del `with` - no se
puede hacer un UPDATE contra una columna que todavía no "existe" en esa reconstrucción
diferida dentro del mismo bloque.

users.default_currency/debts.currency/goals.currency/wallets.currency (NOT NULL) usan
COALESCE a USD como respaldo si el string existente no matchea ningún código de
currencies (no debería pasar en la práctica, pero evita romper la migración por un dato
sucio). transaction_drafts.parsed_currency queda NULL si no matchea (columna nullable,
ya representa "sin detectar").

Revision ID: 202608300002
Revises: 202608300001
Create Date: 2026-08-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202608300002"
down_revision: Union[str, None] = "202608300001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill_required(table: str, old_column: str, new_column: str) -> None:
    op.execute(
        sa.text(
            f"""
            UPDATE {table}
            SET {new_column} = COALESCE(
                (SELECT id FROM currencies WHERE code = {table}.{old_column}),
                (SELECT id FROM currencies WHERE code = 'USD')
            )
            """
        )
    )


def _backfill_nullable(table: str, old_column: str, new_column: str) -> None:
    op.execute(
        sa.text(
            f"""
            UPDATE {table}
            SET {new_column} = (SELECT id FROM currencies WHERE code = {table}.{old_column})
            WHERE {table}.{old_column} IS NOT NULL
            """
        )
    )


def upgrade() -> None:
    # --- wallets.currency -> currency_id ---
    with op.batch_alter_table("wallets") as batch_op:
        batch_op.add_column(sa.Column("currency_id", postgresql.UUID(as_uuid=True), nullable=True))
    _backfill_required("wallets", "currency", "currency_id")
    with op.batch_alter_table("wallets") as batch_op:
        batch_op.alter_column("currency_id", nullable=False)
        batch_op.create_foreign_key("fk_wallets_currency_id", "currencies", ["currency_id"], ["id"])
        batch_op.create_index("ix_wallets_currency_id", ["currency_id"])
        batch_op.drop_column("currency")

    # --- debts.currency -> currency_id ---
    with op.batch_alter_table("debts") as batch_op:
        batch_op.add_column(sa.Column("currency_id", postgresql.UUID(as_uuid=True), nullable=True))
    _backfill_required("debts", "currency", "currency_id")
    with op.batch_alter_table("debts") as batch_op:
        batch_op.alter_column("currency_id", nullable=False)
        batch_op.create_foreign_key("fk_debts_currency_id", "currencies", ["currency_id"], ["id"])
        batch_op.create_index("ix_debts_currency_id", ["currency_id"])
        batch_op.drop_column("currency")

    # --- goals.currency -> currency_id ---
    with op.batch_alter_table("goals") as batch_op:
        batch_op.add_column(sa.Column("currency_id", postgresql.UUID(as_uuid=True), nullable=True))
    _backfill_required("goals", "currency", "currency_id")
    with op.batch_alter_table("goals") as batch_op:
        batch_op.alter_column("currency_id", nullable=False)
        batch_op.create_foreign_key("fk_goals_currency_id", "currencies", ["currency_id"], ["id"])
        batch_op.create_index("ix_goals_currency_id", ["currency_id"])
        batch_op.drop_column("currency")

    # --- users.default_currency -> default_currency_id ---
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("default_currency_id", postgresql.UUID(as_uuid=True), nullable=True))
    _backfill_required("users", "default_currency", "default_currency_id")
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("default_currency_id", nullable=False)
        batch_op.create_foreign_key("fk_users_default_currency_id", "currencies", ["default_currency_id"], ["id"])
        batch_op.create_index("ix_users_default_currency_id", ["default_currency_id"])
        batch_op.drop_column("default_currency")

    # --- transaction_drafts.parsed_currency -> parsed_currency_id (nullable) ---
    with op.batch_alter_table("transaction_drafts") as batch_op:
        batch_op.add_column(sa.Column("parsed_currency_id", postgresql.UUID(as_uuid=True), nullable=True))
    _backfill_nullable("transaction_drafts", "parsed_currency", "parsed_currency_id")
    with op.batch_alter_table("transaction_drafts") as batch_op:
        batch_op.create_foreign_key(
            "fk_transaction_drafts_parsed_currency_id", "currencies", ["parsed_currency_id"], ["id"]
        )
        batch_op.create_index("ix_transaction_drafts_parsed_currency_id", ["parsed_currency_id"])
        batch_op.drop_column("parsed_currency")

    # --- exchange_rates.base_currency/quote_currency -> *_id ---
    with op.batch_alter_table("exchange_rates") as batch_op:
        batch_op.add_column(sa.Column("base_currency_id", postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.add_column(sa.Column("quote_currency_id", postgresql.UUID(as_uuid=True), nullable=True))
    _backfill_required("exchange_rates", "base_currency", "base_currency_id")
    _backfill_required("exchange_rates", "quote_currency", "quote_currency_id")
    with op.batch_alter_table("exchange_rates") as batch_op:
        batch_op.alter_column("base_currency_id", nullable=False)
        batch_op.alter_column("quote_currency_id", nullable=False)
        batch_op.create_foreign_key("fk_exchange_rates_base_currency_id", "currencies", ["base_currency_id"], ["id"])
        batch_op.create_foreign_key(
            "fk_exchange_rates_quote_currency_id", "currencies", ["quote_currency_id"], ["id"]
        )
        batch_op.create_index("ix_exchange_rates_base_currency_id", ["base_currency_id"])
        batch_op.create_index("ix_exchange_rates_quote_currency_id", ["quote_currency_id"])
        batch_op.drop_index("ix_exchange_rates_base_currency")
        batch_op.drop_index("ix_exchange_rates_quote_currency")
        batch_op.drop_column("base_currency")
        batch_op.drop_column("quote_currency")


def downgrade() -> None:
    with op.batch_alter_table("exchange_rates") as batch_op:
        batch_op.add_column(sa.Column("base_currency", sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column("quote_currency", sa.String(length=10), nullable=True))
    op.execute(
        sa.text(
            "UPDATE exchange_rates SET base_currency = "
            "(SELECT code FROM currencies WHERE id = exchange_rates.base_currency_id)"
        )
    )
    op.execute(
        sa.text(
            "UPDATE exchange_rates SET quote_currency = "
            "(SELECT code FROM currencies WHERE id = exchange_rates.quote_currency_id)"
        )
    )
    with op.batch_alter_table("exchange_rates") as batch_op:
        batch_op.alter_column("base_currency", nullable=False)
        batch_op.alter_column("quote_currency", nullable=False)
        batch_op.create_index("ix_exchange_rates_base_currency", ["base_currency"])
        batch_op.create_index("ix_exchange_rates_quote_currency", ["quote_currency"])
        batch_op.drop_index("ix_exchange_rates_base_currency_id")
        batch_op.drop_index("ix_exchange_rates_quote_currency_id")
        batch_op.drop_constraint("fk_exchange_rates_base_currency_id", type_="foreignkey")
        batch_op.drop_constraint("fk_exchange_rates_quote_currency_id", type_="foreignkey")
        batch_op.drop_column("base_currency_id")
        batch_op.drop_column("quote_currency_id")

    with op.batch_alter_table("transaction_drafts") as batch_op:
        batch_op.add_column(sa.Column("parsed_currency", sa.String(length=10), nullable=True))
    op.execute(
        sa.text(
            "UPDATE transaction_drafts SET parsed_currency = "
            "(SELECT code FROM currencies WHERE id = transaction_drafts.parsed_currency_id)"
        )
    )
    with op.batch_alter_table("transaction_drafts") as batch_op:
        batch_op.drop_index("ix_transaction_drafts_parsed_currency_id")
        batch_op.drop_constraint("fk_transaction_drafts_parsed_currency_id", type_="foreignkey")
        batch_op.drop_column("parsed_currency_id")

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("default_currency", sa.String(length=10), nullable=True))
    op.execute(
        sa.text(
            "UPDATE users SET default_currency = (SELECT code FROM currencies WHERE id = users.default_currency_id)"
        )
    )
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("default_currency", nullable=False)
        batch_op.drop_index("ix_users_default_currency_id")
        batch_op.drop_constraint("fk_users_default_currency_id", type_="foreignkey")
        batch_op.drop_column("default_currency_id")

    with op.batch_alter_table("goals") as batch_op:
        batch_op.add_column(sa.Column("currency", sa.String(length=10), nullable=True))
    op.execute(sa.text("UPDATE goals SET currency = (SELECT code FROM currencies WHERE id = goals.currency_id)"))
    with op.batch_alter_table("goals") as batch_op:
        batch_op.alter_column("currency", nullable=False)
        batch_op.drop_index("ix_goals_currency_id")
        batch_op.drop_constraint("fk_goals_currency_id", type_="foreignkey")
        batch_op.drop_column("currency_id")

    with op.batch_alter_table("debts") as batch_op:
        batch_op.add_column(sa.Column("currency", sa.String(length=10), nullable=True))
    op.execute(sa.text("UPDATE debts SET currency = (SELECT code FROM currencies WHERE id = debts.currency_id)"))
    with op.batch_alter_table("debts") as batch_op:
        batch_op.alter_column("currency", nullable=False)
        batch_op.drop_index("ix_debts_currency_id")
        batch_op.drop_constraint("fk_debts_currency_id", type_="foreignkey")
        batch_op.drop_column("currency_id")

    with op.batch_alter_table("wallets") as batch_op:
        batch_op.add_column(sa.Column("currency", sa.String(length=10), nullable=True))
    op.execute(sa.text("UPDATE wallets SET currency = (SELECT code FROM currencies WHERE id = wallets.currency_id)"))
    with op.batch_alter_table("wallets") as batch_op:
        batch_op.alter_column("currency", nullable=False)
        batch_op.drop_index("ix_wallets_currency_id")
        batch_op.drop_constraint("fk_wallets_currency_id", type_="foreignkey")
        batch_op.drop_column("currency_id")
