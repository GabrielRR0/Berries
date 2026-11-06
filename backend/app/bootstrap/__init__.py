"""Arma la app de FastAPI. La usan `app/main.py` y las pruebas."""

from app.bootstrap.configure_app import create_app

__all__ = ["create_app"]
