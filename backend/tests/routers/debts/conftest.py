from app.main import app
from app.routers.debts.debts_router import router as debts_router

_ROUTE_PREFIX = "/api/debts"

# El router de debts todavía no está registrado en app/main.py (archivo compartido que
# no debe tocarse en esta tarea — otro trabajo en paralelo es dueño de él). Se incluye
# aquí, en tiempo de test, para poder ejercitar los endpoints reales a través del
# fixture `client` de tests/conftest.py sin modificar main.py. La guardia evita
# registrarlo dos veces si este módulo llega a importarse más de una vez.
if not any(getattr(route, "path", "").startswith(_ROUTE_PREFIX) for route in app.routes):
    app.include_router(debts_router, prefix=_ROUTE_PREFIX, tags=["debts"])
