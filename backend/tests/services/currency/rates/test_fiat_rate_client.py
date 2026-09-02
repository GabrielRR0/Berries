from decimal import Decimal

import httpx

from app.config import settings
from app.services.currency.rates.fiat_rate_client import fetch_fiat_rates


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict:
        return self._payload


def test_fetch_fiat_rates_uses_the_fallback_without_an_app_id(monkeypatch):
    monkeypatch.setattr(settings, "open_exchange_rates_app_id", "")

    rates = fetch_fiat_rates()

    assert rates["EUR"] == Decimal("0.92")


def test_fetch_fiat_rates_fallback_never_includes_vef(monkeypatch):
    """VEF tiene su propio cliente (venezuela_rate_client.fetch_vef_rate, dolarapi.com)
    - pedido explícito del usuario: para bolívares prefiere no tramitar ninguna key,
    a diferencia de EUR/COP/ARS que sí van por Open Exchange Rates. Nunca debe
    resolverse acá, ni siquiera como fallback."""
    monkeypatch.setattr(settings, "open_exchange_rates_app_id", "")

    rates = fetch_fiat_rates()

    assert "VEF" not in rates


def test_fetch_fiat_rates_calls_the_real_api_with_an_app_id(monkeypatch):
    monkeypatch.setattr(settings, "open_exchange_rates_app_id", "una-key-real")
    monkeypatch.setattr(httpx, "get", lambda *a, **kw: _FakeResponse({"rates": {"EUR": 0.92, "COP": 4123.5}}))

    rates = fetch_fiat_rates()

    assert rates["EUR"] == Decimal("0.92")
    assert rates["COP"] == Decimal("4123.5")


def test_fetch_fiat_rates_sends_the_configured_app_id(monkeypatch):
    monkeypatch.setattr(settings, "open_exchange_rates_app_id", "una-key-real")
    captured = {}

    def _fake_get(url, params, timeout):
        captured["params"] = params
        return _FakeResponse({"rates": {"EUR": 0.92}})

    monkeypatch.setattr(httpx, "get", _fake_get)

    fetch_fiat_rates()

    assert captured["params"]["app_id"] == "una-key-real"
    assert captured["params"]["base"] == "USD"
