"""create currencies table

Revision ID: 202608300001
Revises: 202608280006
Create Date: 2026-08-30

"""

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.services.currency.supported_currencies import SUPPORTED_CURRENCIES

revision: str = "202608300001"
down_revision: Union[str, None] = "202608280006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

currencies_table = sa.table(
    "currencies",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("code", sa.String),
    sa.column("name", sa.String),
    sa.column("symbol", sa.String),
    sa.column("locale", sa.String),
)


def upgrade() -> None:
    op.create_table(
        "currencies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("symbol", sa.String(length=10), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
    )
    op.create_index("ix_currencies_code", "currencies", ["code"], unique=True)

    op.bulk_insert(
        currencies_table,
        [
            {"id": uuid.uuid4(), "code": code, "name": name, "symbol": symbol, "locale": locale}
            for code, name, symbol, locale in SUPPORTED_CURRENCIES
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_currencies_code", table_name="currencies")
    op.drop_table("currencies")
