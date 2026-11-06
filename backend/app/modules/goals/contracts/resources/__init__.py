"""Lo que SALE por HTTP: un modelo por respuesta."""

from app.modules.goals.contracts.resources.goal_check_in_resource import GoalCheckInResource
from app.modules.goals.contracts.resources.goal_resource import GoalResource
from app.modules.goals.contracts.resources.goal_savings_capacity_resource import GoalSavingsCapacityResource
from app.modules.goals.contracts.resources.goal_summary_resource import GoalSummaryResource
from app.modules.goals.contracts.resources.goal_voice_preview_resource import GoalVoicePreviewResource
from app.modules.goals.contracts.resources.pending_check_in_resource import PendingCheckInResource
from app.modules.goals.contracts.resources.wallet_commitment_resource import WalletCommitmentResource

__all__ = [
    "GoalCheckInResource",
    "GoalResource",
    "GoalSavingsCapacityResource",
    "GoalSummaryResource",
    "GoalVoicePreviewResource",
    "PendingCheckInResource",
    "WalletCommitmentResource",
]
