"""Levanta backend + frontend de Berry en local con un solo comando: `python run.py`.

Solo para desarrollo local — Vercel no usa este script (cada servicio se despliega por
separado vía vercel.json), igual que el run.py equivalente de tayuya-check.
"""
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
IS_WINDOWS = os.name == "nt"

# Sin default en app/config.py (Settings) — si faltan, la app falla al arrancar.
REQUIRED_BACKEND_VARS = ["DATABASE_URL", "JWT_SECRET", "MASTER_ENCRYPTION_KEY"]

# Requisito real de Vite (ver frontend/node_modules/vite/package.json → engines.node):
# "^20.19.0 || >=22.12.0". Con una versión menor, `npm run dev` no tira un error claro
# — falla adentro de node_modules/rolldown con un SyntaxError críptico sobre
# `node:util.styleText` (agregado recién en Node 20.12/21.7), así que se valida acá antes.
MIN_NODE_20 = (20, 19)
MIN_NODE_22 = (22, 12)


def check_node_version() -> bool:
    result = subprocess.run(["node", "--version"], capture_output=True, text=True, shell=IS_WINDOWS)
    match = re.match(r"v(\d+)\.(\d+)", result.stdout.strip())
    if not match:
        print("! No se pudo detectar la versión de Node instalada — ¿está en el PATH?")
        return False

    major, minor = int(match.group(1)), int(match.group(2))
    ok = (major == 20 and (major, minor) >= MIN_NODE_20) or (major >= 22 and (major, minor) >= MIN_NODE_22)
    if not ok:
        print(f"! Node {major}.{minor} es muy viejo para este frontend (Vite exige ^20.19.0 || >=22.12.0).")
        print("! Si tenés nvm-windows instalado: nvm list, y después nvm use <versión válida>.")
        return False
    return True


def _venv_python() -> Path:
    return BACKEND / ".venv" / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")


def _read_env_value(path: Path, key: str) -> str:
    if not path.exists():
        return ""
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() == key:
            return v.strip()
    return ""


def ensure_backend_ready() -> bool:
    venv_python = _venv_python()
    if not venv_python.exists():
        print("-> Creando entorno virtual del backend...")
        subprocess.run([sys.executable, "-m", "venv", str(BACKEND / ".venv")], check=True)
        print("-> Instalando dependencias del backend...")
        subprocess.run(
            [str(venv_python), "-m", "pip", "install", "--quiet", "-r", str(BACKEND / "requirements.txt")],
            check=True,
        )

    env_file = BACKEND / ".env"
    if not env_file.exists():
        shutil.copy(BACKEND / ".env.example", env_file)
        print(f"! Se creó {env_file} a partir de .env.example.")
        print(f"! Completá al menos {', '.join(REQUIRED_BACKEND_VARS)} antes de continuar.")
        return False

    missing = [var for var in REQUIRED_BACKEND_VARS if not _read_env_value(env_file, var)]
    if missing:
        print(f"! Faltan completar en backend/.env: {', '.join(missing)}")
        print("! La app no arranca sin esos valores (ver backend/README.md).")
        return False
    return True


def ensure_frontend_ready() -> bool:
    if not check_node_version():
        return False

    if not (FRONTEND / "node_modules").exists():
        print("-> Instalando dependencias del frontend (npm install)...")
        subprocess.run(["npm", "install"], cwd=FRONTEND, check=True, shell=IS_WINDOWS)

    env_file = FRONTEND / ".env"
    example = FRONTEND / ".env.example"
    if not env_file.exists() and example.exists():
        shutil.copy(example, env_file)
    return True


def run_migrations(venv_python: Path) -> bool:
    print("-> Corriendo migraciones (alembic upgrade head)...")
    result = subprocess.run([str(venv_python), "-m", "alembic", "upgrade", "head"], cwd=BACKEND)
    if result.returncode != 0:
        print("! Las migraciones fallaron — revisá que DATABASE_URL en backend/.env sea válido y alcanzable.")
        return False
    return True


def main() -> None:
    backend_ready = ensure_backend_ready()
    frontend_ready = ensure_frontend_ready()

    if not backend_ready or not frontend_ready:
        print("\nResolvé lo de arriba y volvé a correr `python run.py`.")
        return

    venv_python = _venv_python()
    if not run_migrations(venv_python):
        return

    print("\n-> Backend en http://localhost:8002 (docs en /docs)")
    print("-> Frontend en http://localhost:5173 (o el próximo puerto libre)")
    print("-> Ctrl+C para detener ambos.\n")

    # Puerto 8002, no 8000: s-rank ya usa 8000 y tayuya-check usa 8001 (convención
    # del portafolio para poder correr varios proyectos hermanos a la vez sin que
    # el proxy de uno le pegue al backend de otro).
    backend_proc = subprocess.Popen(
        [str(venv_python), "-m", "uvicorn", "app.main:app", "--reload", "--port", "8002"], cwd=BACKEND
    )
    frontend_proc = subprocess.Popen(["npm", "run", "dev"], cwd=FRONTEND, shell=IS_WINDOWS)

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\n-> Deteniendo...")
    finally:
        backend_proc.terminate()
        frontend_proc.terminate()


if __name__ == "__main__":
    main()
