"""Valores fijos que comparten lo que entra (dto) y lo que sale (resources)."""

from typing import Literal

Status = Literal["active", "completed", "abandoned"]
# Plantillas fijas del paso 1 del alta ("¿Cuál es tu objetivo?") - "custom" es
# "Personalizada" (sin plantilla, solo el titulo que escriba el usuario). Decide que
# icono usa GoalCard.vue/CreateGoalForm.vue - nunca texto libre.
GoalType = Literal["study", "business", "course", "housing", "travel", "vehicle", "computer", "phone", "custom"]
