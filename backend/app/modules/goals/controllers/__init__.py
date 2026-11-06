"""Controllers del módulo, en el orden en que se registran: las rutas fijas
(/summary, /pending-check-ins...) antes que `/{goal_id}`."""

from app.modules.goals.controllers.private.user import goal_check_ins_controller, goal_overview_controller, goals_controller

goals_routers = [
    goal_overview_controller.router,
    goal_check_ins_controller.router,
    goals_controller.router,
]
