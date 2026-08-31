"""add goal_type to goals

Revision ID: 202608280006
Revises: 202608280005
Create Date: 2026-08-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "202608280006"
down_revision: Union[str, None] = "202608280005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "goals", sa.Column("goal_type", sa.String(length=30), nullable=False, server_default="custom")
    )


def downgrade() -> None:
    op.drop_column("goals", "goal_type")
