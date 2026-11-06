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
