"""create goal_check_ins table

Revision ID: 202608280002
Revises: 202608280001
Create Date: 2026-08-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202608280002"
down_revision: Union[str, None] = "202608280001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goal_check_ins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("goals.id"), nullable=False),
        sa.Column("period_month", sa.Date(), nullable=False),
        sa.Column("amount_saved", sa.Text(), nullable=False),
        sa.Column("previous_target_date", sa.Date(), nullable=True),
        sa.Column("new_target_date", sa.Date(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # NO unico: permite mas de un aporte por mes (top-up ad-hoc ademas del check-in
    # mensual), ver goal_check_in_model.py.
    op.create_index("ix_goal_check_ins_goal_id_period_month", "goal_check_ins", ["goal_id", "period_month"])


def downgrade() -> None:
    op.drop_table("goal_check_ins")
