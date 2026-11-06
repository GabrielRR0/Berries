"""Arma el paquete del backend como lo hace Vercel y arranca la app desde ahí.

Vercel no sube la carpeta tal cual: toma los archivos del repositorio y descarta los que
coinciden con su lista de exclusiones (por ejemplo cualquier carpeta `public/`, que
reserva para archivos estáticos). Si un archivo que la app importa queda fuera, en
producción TODOS los endpoints responden FUNCTION_INVOCATION_FAILED, aunque local y en
el resto de las pruebas todo funcione. Pasó con `controllers/public/`.

Esta prueba reproduce ese empaquetado (con los archivos que están en git, que es lo que
recibe Vercel) y falla antes de subir.
"""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]

# Copiado de @vercel/python 31.0.0 (dist/index.js, `predefinedExcludes` en packFunctionBundle).
# Si Vercel cambia la lista, actualizarla acá.
VERCEL_EXCLUDES = [
    ".git/**",
    ".gitignore",
    ".vercel/**",
    ".pnpm-store/**",
    "**/node_modules/**",
    "**/.next/**",
    "**/.nuxt/**",
    "**/.venv/**",
    "**/venv/**",
    "**/__pycache__/**",
    "**/.mypy_cache/**",
    "**/.ruff_cache/**",
    "**/public/**",
    "**/pnpm-lock.yaml",
    "**/yarn.lock",
    "**/package-lock.json",
]


def _glob_to_regex(pattern: str) -> re.Pattern:
    out = ""
    i = 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
        elif pattern.startswith("/**", i):
            out += "/.*"
            i += 3
        elif pattern[i] == "*":
            out += "[^/]*"
            i += 1
        else:
            out += re.escape(pattern[i])
            i += 1
    return re.compile(f"^{out}$")


EXCLUDE_RES = [_glob_to_regex(p) for p in VERCEL_EXCLUDES]


def _excluded(relative: str) -> bool:
    return any(rx.match(relative) for rx in EXCLUDE_RES)


def _tracked_files() -> list[str]:
    if shutil.which("git") is None:
        pytest.skip("git no está disponible")
    result = subprocess.run(
        ["git", "ls-files", "-z", "--", "."], cwd=BACKEND, capture_output=True, text=True, check=True
    )
    return [f for f in result.stdout.split("\0") if f]


@pytest.fixture(scope="module")
def bundle(tmp_path_factory) -> Path:
    target = tmp_path_factory.mktemp("vercel_bundle")
    for relative in _tracked_files():
        if _excluded(relative):
            continue
        source = BACKEND / relative
        if not source.is_file():
            continue  # borrado localmente y todavía en el índice de git
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    return target


def test_vercel_keeps_every_app_file():
    """Ningún archivo de `app/` cae en las exclusiones de Vercel."""
    dropped = [f for f in _tracked_files() if f.startswith("app/") and _excluded(f)]
    assert not dropped, (
        "Vercel descartaría estos archivos y la app no arrancaría en producción "
        "(renombrar la carpeta, por ejemplo `public/` -> `anonymous/`):\n" + "\n".join(dropped)
    )


def test_app_boots_from_the_vercel_bundle(bundle: Path):
    """Arranca `app.main:app` solo con lo que Vercel subiría, en modo producción, y carga
    todos los módulos de `app/` (también los que la API pública carga a pedido)."""
    script = """
import importlib, pkgutil, sys
sys.path.insert(0, sys.argv[1])
from fastapi.testclient import TestClient
from app.main import app
import app as app_pkg
for info in pkgutil.walk_packages(app_pkg.__path__, "app."):
    if ".tests" not in info.name:
        importlib.import_module(info.name)
response = TestClient(app).get("/api/health")
assert response.status_code == 200, response.text
print("ok")
"""
    env = {
        **os.environ,
        "ENVIRONMENT": "production",
        "DATABASE_URL": "sqlite://",
        "JWT_SECRET": "bundle-check-secret",
        "MASTER_ENCRYPTION_KEY": "2H-8GUYtz7lmoCEmjSgqIOzVbrOoRc6LMLNz31YPCwo=",
        "FRONTEND_URL": "https://example.com",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    env.pop("PYTHONPATH", None)
    result = subprocess.run(
        [sys.executable, "-c", script, str(bundle)], cwd=bundle, env=env, capture_output=True, text=True, timeout=120
    )
    assert result.returncode == 0 and result.stdout.strip().endswith("ok"), (
        "La app no arranca con el paquete que armaría Vercel:\n" + result.stderr[-3000:]
    )
