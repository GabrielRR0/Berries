"""Reglas de arquitectura comprobadas con código (ver docs/CONVENCIONES.md).

Cada prueba explica qué regla cuida. Si una falla, el mensaje dice qué archivo la
rompe y cómo arreglarlo.
"""

import ast
import importlib
from pathlib import Path

from fastapi.routing import APIRoute

from app.common.security.groups import AUTH, CRON, PUBLIC
from app.main import app

BACKEND = Path(__file__).resolve().parents[2]
APP = BACKEND / "app"
MODULES = APP / "modules"

MAX_LINES = 600
# Paquete de terceros -> la única carpeta que puede importarlo.
THIRD_PARTY = {
    "bcrypt": "password_support",
    "jwt": "jwt_support",
    "cryptography": "crypto_support",
    "httpx": "http_support",
    "slowapi": "rate_limit_support",
}
# Carpeta del controller -> grupo de acceso que debe declarar su router.
CONTROLLER_FOLDERS = {
    ("public",): PUBLIC,
    ("private", "user"): AUTH,
    ("system",): CRON,
}


def _py_files(root: Path):
    return [p for p in root.rglob("*.py") if "__pycache__" not in p.parts]


def _rel(path: Path) -> str:
    return path.relative_to(BACKEND).as_posix()


def _imports(path: Path):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            yield node.lineno, node.module
        elif isinstance(node, ast.Import):
            for alias in node.names:
                yield node.lineno, alias.name


def _owner_module(path: Path) -> str | None:
    parts = path.relative_to(APP).parts
    return parts[1] if len(parts) > 2 and parts[0] == "modules" else None


def test_other_modules_are_only_imported_through_their_public_api():
    """De otro módulo solo se importa `app.modules.<m>` (su __init__.py), nunca un
    archivo interno. Así cada módulo puede reorganizarse por dentro sin romper a nadie."""
    problems = []
    for path in _py_files(APP):
        owner = _owner_module(path)
        for line, module in _imports(path):
            parts = module.split(".")
            if len(parts) > 3 and parts[:2] == ["app", "modules"] and parts[2] != owner:
                problems.append(f"{_rel(path)}:{line} importa {module} -> usar `from app.modules.{parts[2]} import ...`")
    assert not problems, "\n".join(problems)


def test_controllers_only_talk_to_the_module_facade():
    """Un controller llama a `services` (la fachada del módulo), nunca a un archivo
    de services/ directo."""
    problems = []
    for path in _py_files(MODULES):
        if "controllers" not in path.parts:
            continue
        module = _owner_module(path)
        for line, imported in _imports(path):
            if imported.startswith(f"app.modules.{module}.services."):
                problems.append(f"{_rel(path)}:{line} importa {imported} -> usar `from app.modules.{module} import services`")
    assert not problems, "\n".join(problems)


def test_controller_folder_matches_its_access_group():
    """`controllers/public/` usa public_group(), `controllers/private/user/` usa
    auth_group() y `controllers/system/` usa cron_group(). Abrir una carpeta dice
    quién puede usar esas rutas."""
    problems = []
    found = 0
    for path in _py_files(MODULES):
        if not path.name.endswith("_controller.py"):
            continue
        found += 1
        parts = path.relative_to(MODULES).parts  # (<modulo>, "controllers", ..., archivo)
        folder = tuple(parts[2:-1])
        expected = CONTROLLER_FOLDERS.get(folder)
        if expected is None:
            problems.append(f"{_rel(path)}: carpeta {'/'.join(folder) or '(raíz)'} no es de acceso conocido {list(CONTROLLER_FOLDERS)}")
            continue
        dotted = ".".join(path.relative_to(BACKEND).with_suffix("").parts)
        router = importlib.import_module(dotted).router
        actual = getattr(router, "access_group", None)
        if actual != expected:
            problems.append(f"{_rel(path)}: está en {'/'.join(folder)} pero su router es {actual!r} (debe ser {expected!r})")
    assert found, "no se encontró ningún controller"
    assert not problems, "\n".join(problems)


def _resource_class(annotation):
    args = getattr(annotation, "__args__", None)
    return _resource_class(args[0]) if args else annotation


def test_every_route_declares_a_resource():
    """Toda ruta que responde algo declara su `response_model`, y es un Resource de
    `contracts/resources/`. FastAPI filtra la respuesta con ese modelo: un campo que el
    Resource no declara nunca sale."""
    problems = []
    for route in app.routes:
        if not isinstance(route, APIRoute) or route.status_code == 204:
            continue
        model = _resource_class(route.response_model) if route.response_model else None
        if model is None or ".contracts.resources." not in getattr(model, "__module__", ""):
            problems.append(f"{sorted(route.methods)} {route.path}: response_model={route.response_model!r}")
        elif not model.__name__.endswith("Resource"):
            problems.append(f"{route.path}: {model.__name__} debe terminar en Resource")
    assert not problems, "\n".join(problems)


def test_dto_and_resource_names_say_their_role():
    """Lo que entra termina en `Dto` y vive en contracts/dto/; lo que sale termina en
    `Resource` y vive en contracts/resources/."""
    problems = []
    for path in _py_files(MODULES):
        if "contracts" not in path.parts or path.name == "__init__.py":
            continue
        kind = path.parent.name
        suffix = {"dto": "Dto", "resources": "Resource"}.get(kind)
        if suffix is None:
            continue
        for node in ast.parse(path.read_text(encoding="utf-8")).body:
            if isinstance(node, ast.ClassDef) and not node.name.endswith(suffix):
                problems.append(f"{_rel(path)}: {node.name} debe terminar en {suffix}")
    assert not problems, "\n".join(problems)


def test_environment_is_only_read_in_config():
    """Solo `app/config/` lee variables de entorno; el resto pide `settings.<campo>`."""
    problems = []
    for path in _py_files(APP):
        if path.is_relative_to(APP / "config"):
            continue
        text = path.read_text(encoding="utf-8")
        for needle in ("os.environ", "os.getenv", "getenv("):
            if needle in text:
                problems.append(f"{_rel(path)} usa {needle} -> agregar el campo en app/config/settings.py")
    assert not problems, "\n".join(problems)


def test_third_party_packages_only_inside_support():
    """Los paquetes de terceros se usan solo desde su envoltorio en `app/support/`:
    cambiar de paquete (o de versión mayor) toca un solo lugar. Las pruebas sí pueden
    importarlos para simularlos (por ejemplo `monkeypatch.setattr(httpx, "get", ...)`)."""
    problems = []
    for path in _py_files(APP):
        if "tests" in path.parts:
            continue
        for line, module in _imports(path):
            top = module.split(".")[0]
            home = THIRD_PARTY.get(top)
            if home and not path.is_relative_to(APP / "support" / home):
                problems.append(f"{_rel(path)}:{line} importa {top} -> usar app.support.{home}")
    assert not problems, "\n".join(problems)


def test_no_file_is_longer_than_600_lines():
    """Un archivo que crece se parte en archivos con nombre propio."""
    too_long = []
    for root in (APP, BACKEND / "tests"):
        for path in _py_files(root):
            lines = len(path.read_text(encoding="utf-8").splitlines())
            if lines > MAX_LINES:
                too_long.append(f"{_rel(path)}: {lines} líneas")
    assert not too_long, "\n".join(too_long)


def _documented_folders():
    yield from (APP / name for name in ("bootstrap", "config", "database", "routes", "common", "support", "modules"))
    for parent in (APP / "common", APP / "support"):
        yield from (p for p in parent.iterdir() if p.is_dir() and p.name != "__pycache__")
    for module in MODULES.iterdir():
        if module.is_dir() and module.name != "__pycache__":
            yield module
            yield from (module / layer for layer in ("controllers", "contracts", "services") if (module / layer).is_dir())


def test_every_folder_has_a_readme():
    """Se entiende qué hay en una carpeta y para qué sirve sin abrir el código."""
    missing = [_rel(folder) for folder in _documented_folders() if not (folder / "README.md").exists()]
    assert not missing, "Falta README.md en:\n" + "\n".join(missing)
