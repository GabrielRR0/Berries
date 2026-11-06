"""Controllers del módulo, en el orden en que se registran."""

from app.modules.voice_entry.controllers.private.user import voice_entry_controller

voice_entry_routers = [
    voice_entry_controller.router,
]
