"""create hidden_categories table

Revision ID: 202608280004
Revises: 202608280003
Create Date: 2026-08-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202608280004"
down_revision: Union[str, None] = "202608280003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # El UNIQUE va inline en create_table (no como op.create_unique_constraint()
    # separado despues): SQLite no soporta ALTER TABLE ... ADD CONSTRAINT, asi que
    # agregarlo como paso aparte falla ahi (aunque funcionaria en Postgres).
    op.create_table(
        "hidden_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "category_id", name="uq_hidden_categories_user_category"),
    )
    op.create_index("ix_hidden_categories_user_id", "hidden_categories", ["user_id"])
    op.create_index("ix_hidden_categories_category_id", "hidden_categories", ["category_id"])


def downgrade() -> None:
    op.drop_table("hidden_categories")
