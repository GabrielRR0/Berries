"""Punto de entrada (uvicorn y Vercel usan `app.main:app`)."""

from app.bootstrap import create_app

app = create_app()
