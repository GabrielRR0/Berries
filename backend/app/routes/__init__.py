"""Árbol de rutas: `/api` y, debajo, un archivo por módulo. Ver README.md."""

from app.routes.api_routes import api_router

__all__ = ["api_router"]
