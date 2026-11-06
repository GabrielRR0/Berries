# contracts/ — goals

Todo lo que entra y sale por HTTP, y nada más. No importa de controllers ni de services (solo al revés).

## `dto/` — lo que ENTRA (body y query, validado por Pydantic)

- `create_goal_check_in_dto.py` — `CreateGoalCheckInDto`
- `create_goal_dto.py` — `CreateGoalDto`
- `goal_voice_preview_dto.py` — `GoalVoicePreviewDto`
- `update_goal_check_in_dto.py` — `UpdateGoalCheckInDto`
- `update_goal_dto.py` — `UpdateGoalDto`

## `resources/` — lo que SALE (una clase por respuesta)

- `goal_check_in_resource.py` — `GoalCheckInResource`
- `goal_resource.py` — `GoalResource`
- `goal_savings_capacity_resource.py` — `GoalSavingsCapacityResource`
- `goal_summary_resource.py` — `GoalSummaryResource`
- `goal_voice_preview_resource.py` — `GoalVoicePreviewResource`
- `pending_check_in_resource.py` — `PendingCheckInResource`
- `wallet_commitment_resource.py` — `WalletCommitmentResource`

## `enums.py`

Valores fijos que comparten la entrada y la salida: `Status, GoalType`.
