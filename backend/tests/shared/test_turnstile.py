import httpx
import pytest

from app.config import settings
from app.shared.turnstile import TurnstileVerificationError, verify_turnstile


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict:
        return self._payload


def test_verify_turnstile_is_a_noop_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "turnstile_enabled", False)

    # No deberia ni intentar llamar a Cloudflare - si lo hiciera, esto fallaria con
    # un error de red real en el entorno de test.
    verify_turnstile(None)
    verify_turnstile("cualquier-token")


def test_verify_turnstile_rejects_a_missing_token_when_enabled(monkeypatch):
    monkeypatch.setattr(settings, "turnstile_enabled", True)

    with pytest.raises(TurnstileVerificationError):
        verify_turnstile(None)


def test_verify_turnstile_accepts_a_successful_response(monkeypatch):
    monkeypatch.setattr(settings, "turnstile_enabled", True)
    monkeypatch.setattr(settings, "turnstile_secret_key", "fake-secret")
    monkeypatch.setattr(httpx, "post", lambda *a, **kw: _FakeResponse({"success": True}))

    verify_turnstile("token-valido")  # no lanza


def test_verify_turnstile_rejects_a_failed_response(monkeypatch):
    monkeypatch.setattr(settings, "turnstile_enabled", True)
    monkeypatch.setattr(settings, "turnstile_secret_key", "fake-secret")
    monkeypatch.setattr(httpx, "post", lambda *a, **kw: _FakeResponse({"success": False, "error-codes": ["timeout-or-duplicate"]}))

    with pytest.raises(TurnstileVerificationError):
        verify_turnstile("token-usado-dos-veces")


def test_verify_turnstile_sends_the_client_ip_when_given(monkeypatch):
    monkeypatch.setattr(settings, "turnstile_enabled", True)
    monkeypatch.setattr(settings, "turnstile_secret_key", "fake-secret")
    captured = {}

    def _fake_post(url, data, timeout):
        captured["data"] = data
        return _FakeResponse({"success": True})

    monkeypatch.setattr(httpx, "post", _fake_post)

    verify_turnstile("token-valido", remote_ip="1.2.3.4")

    assert captured["data"]["remoteip"] == "1.2.3.4"
