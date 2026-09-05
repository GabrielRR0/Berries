"""add wallet_id to goal_check_ins

Revision ID: 202609040001
Revises: 202609030001
Create Date: 2026-09-04

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202609040001"
down_revision: Union[str, None] = "202609030001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table (no op.add_column suelto): agregar una columna CON foreign key
    # es, para SQLite, una ALTER de constraint - no soportada directo (mismo criterio
    # que 202608280005_add_suggested_wallet_id_to_drafts.py). El modo batch reconstruye
    # la tabla por detras, funciona igual en Postgres.
    with op.batch_alter_table("goal_check_ins") as batch_op:
        batch_op.add_column(sa.Column("wallet_id", postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.create_foreign_key("fk_goal_check_ins_wallet_id", "wallets", ["wallet_id"], ["id"])
        batch_op.create_index("ix_goal_check_ins_wallet_id", ["wallet_id"])


def downgrade() -> None:
    with op.batch_alter_table("goal_check_ins") as batch_op:
        batch_op.drop_index("ix_goal_check_ins_wallet_id")
        batch_op.drop_constraint("fk_goal_check_ins_wallet_id", type_="foreignkey")
        batch_op.drop_column("wallet_id")
