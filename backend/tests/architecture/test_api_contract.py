"""El contrato HTTP (URLs, métodos, parámetros, cuerpos, respuestas y si piden sesión)
no cambia sin querer. Si el cambio es a propósito, regenerar la foto con:

    python -m tests.architecture.api_contract
"""

from app.main import app
from tests.architecture.api_contract import SNAPSHOT_PATH, dump


def test_api_contract_matches_snapshot():
    assert dump(app) == SNAPSHOT_PATH.read_text(encoding="utf-8"), (
        "El contrato de la API cambió. Si es a propósito: python -m tests.architecture.api_contract"
    )
