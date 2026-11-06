"""Fachada del módulo: los controllers y la API pública solo hablan con esto."""

from app.modules.goals.services.check_ins.check_in_service import (
    abandon_goal,
    get_goals_needing_check_in,
    get_goals_needing_check_in_for_user,
    list_check_ins_for_goal,
    list_pending_check_ins,
    record_check_in,
    update_check_in,
)
from app.modules.goals.services.management.goal_read import (
    build_goal_response,
    get_goal_owned_by_user,
    get_goal_summary,
    list_goals_for_user,
)
from app.modules.goals.services.management.goal_write import create_goal, delete_goal, update_goal
from app.modules.goals.services.planning.contribution_calculator import compute_monthly_contribution
from app.modules.goals.services.planning.savings_capacity import get_savings_capacity
from app.modules.goals.services.planning.wallet_commitment_service import (
    get_available_balance,
    get_committed_amounts_for_user,
    list_wallet_commitments,
)
from app.modules.goals.services.voice.goal_voice_service import parse_goal_voice_entry, preview_goal_from_voice

__all__ = [
    "abandon_goal",
    "build_goal_response",
    "compute_monthly_contribution",
    "create_goal",
    "delete_goal",
    "get_available_balance",
    "get_committed_amounts_for_user",
    "get_goal_owned_by_user",
    "get_goal_summary",
    "get_goals_needing_check_in",
    "get_goals_needing_check_in_for_user",
    "get_savings_capacity",
    "list_check_ins_for_goal",
    "list_goals_for_user",
    "list_pending_check_ins",
    "list_wallet_commitments",
    "parse_goal_voice_entry",
    "preview_goal_from_voice",
    "record_check_in",
    "update_check_in",
    "update_goal",
]
