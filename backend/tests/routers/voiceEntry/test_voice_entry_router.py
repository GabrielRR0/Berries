import pytest

from app.core.rate_limit import limiter
from app.main import app
from app.routers.voiceEntry.voice_entry_router import router as voice_entry_router

# app/main.py todavía no incluye este router (queda fuera de los límites de esta tarea
# tocarlo) — se monta acá, sobre el mismo `app` compartido que usa el fixture `client`
# de conftest.py, para poder probar el router real de punta a punta sin tocar main.py.
if not any(getattr(route, "path", "").startswith("/api/voice-entry") for route in app.routes):
    app.include_router(voice_entry_router, prefix="/api/voice-entry", tags=["voiceEntry"])


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # Ver comentario equivalente en tests/routers/wallets/test_wallets_router.py: el
    # limiter de /api/auth/register no se resetea solo entre tests.
    limiter.reset()
    yield


def _register(client, email="ana@example.com"):
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "supersecret123", "display_name": "Ana"}
    )
    return response.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_voice_entry_creates_draft_from_transcript(client):
    # El transcript ya viene hecho por el navegador (Web Speech API) — el backend
    # recibe texto plano en JSON, nunca audio.
    token = _register(client)

    response = client.post(
        "/api/voice-entry",
        headers=_auth_headers(token),
        json={"transcript": "Gasté 15 USDT en el gym"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["source"] == "voice"
    assert body["status"] == "pending"
    assert body["raw_input"] == "Gasté 15 USDT en el gym"
    assert float(body["parsed_amount"]) == 15.0
    assert body["parsed_currency"] == "USDT"
    assert body["parsed_category"] == "Gym"


def test_voice_entry_rejects_empty_transcript(client):
    token = _register(client)

    response = client.post("/api/voice-entry", headers=_auth_headers(token), json={"transcript": ""})

    assert response.status_code == 422


def test_voice_entry_requires_auth(client):
    response = client.post("/api/voice-entry", json={"transcript": "Gasté 15 USD en transporte"})

    assert response.status_code == 401
