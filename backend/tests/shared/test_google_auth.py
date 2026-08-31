import httpx
import pytest

from app.config import settings
from app.shared.google_auth import GoogleAuthError, verify_google_id_token


class _FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def json(self) -> dict:
        return self._payload


def test_verify_google_id_token_rejects_when_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "")

    with pytest.raises(GoogleAuthError):
        verify_google_id_token("cualquier-token")


def test_verify_google_id_token_rejects_a_missing_token(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "fake-client-id")

    with pytest.raises(GoogleAuthError):
        verify_google_id_token(None)


def test_verify_google_id_token_rejects_a_wrong_audience(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "fake-client-id")
    monkeypatch.setattr(
        httpx,
        "get",
        lambda *a, **kw: _FakeResponse({"aud": "otra-app", "sub": "123", "email": "eva@example.com"}),
    )

    with pytest.raises(GoogleAuthError):
        verify_google_id_token("token-de-otra-app")


def test_verify_google_id_token_rejects_a_failed_lookup(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "fake-client-id")
    monkeypatch.setattr(httpx, "get", lambda *a, **kw: _FakeResponse({}, status_code=400))

    with pytest.raises(GoogleAuthError):
        verify_google_id_token("token-invalido-o-vencido")


def test_verify_google_id_token_returns_the_identity_on_success(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "fake-client-id")
    monkeypatch.setattr(
        httpx,
        "get",
        lambda *a, **kw: _FakeResponse(
            {
                "aud": "fake-client-id",
                "sub": "google-user-123",
                "email": "eva@example.com",
                "email_verified": "true",
                "name": "Eva",
            }
        ),
    )

    identity = verify_google_id_token("token-valido")

    assert identity.sub == "google-user-123"
    assert identity.email == "eva@example.com"
    assert identity.email_verified is True
    assert identity.name == "Eva"
