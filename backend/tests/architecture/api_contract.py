"""Foto del contrato HTTP de la API, independiente de cómo se llamen las clases.

Toma el OpenAPI de la app, reemplaza cada `$ref` por el schema al que apunta y quita
los `title` (que salen del nombre de la clase). Así, renombrar `DebtResponse` a
`DebtResource` no cambia la foto, pero cambiar una URL, un método, un parámetro,
un campo, un código de estado o si la ruta pide sesión, sí.
"""

import json
from pathlib import Path

from fastapi import FastAPI

SNAPSHOT_PATH = Path(__file__).with_name("api_contract_snapshot.json")

_IGNORED_KEYS = {"title", "operationId", "summary", "description", "tags"}


def _resolve(node, schemas: dict, seen: tuple[str, ...] = ()):
    if isinstance(node, dict):
        ref = node.get("$ref")
        if ref:
            name = ref.rsplit("/", 1)[-1]
            if name in seen:
                return {"$recursive": True}
            return _resolve(schemas[name], schemas, seen + (name,))
        return {k: _resolve(v, schemas, seen) for k, v in sorted(node.items()) if k not in _IGNORED_KEYS}
    if isinstance(node, list):
        return [_resolve(item, schemas, seen) for item in node]
    return node


def build_contract(app: FastAPI) -> dict:
    spec = app.openapi()
    schemas = spec.get("components", {}).get("schemas", {})
    paths = {}
    for path, operations in sorted(spec["paths"].items()):
        paths[path] = {method: _resolve(op, schemas) for method, op in sorted(operations.items())}
    return paths


def dump(app: FastAPI) -> str:
    return json.dumps(build_contract(app), indent=1, sort_keys=True, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    from app.main import app

    SNAPSHOT_PATH.write_text(dump(app), encoding="utf-8")
    print(f"Foto actualizada: {SNAPSHOT_PATH}")
