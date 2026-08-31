"""seed default categories

Revision ID: 202608280003
Revises: 202608280002
Create Date: 2026-08-28

"""

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.services.transactions.categories.default_categories import DEFAULT_CATEGORIES

revision: str = "202608280003"
down_revision: Union[str, None] = "202608280002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

categories_table = sa.table(
    "categories",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("user_id", postgresql.UUID(as_uuid=True)),
    sa.column("name", sa.String),
    sa.column("kind", sa.String),
)


def upgrade() -> None:
    op.bulk_insert(
        categories_table,
        [{"id": uuid.uuid4(), "user_id": None, "name": name, "kind": kind} for name, kind in DEFAULT_CATEGORIES],
    )


def downgrade() -> None:
    op.execute(categories_table.delete().where(categories_table.c.user_id.is_(None)))
