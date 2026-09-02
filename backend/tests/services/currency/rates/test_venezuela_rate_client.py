from decimal import Decimal

import httpx

from app.services.currency.rates.venezuela_rate_client import fetch_vef_rate


class _FakeResponse:
    def __init__(self, payload: dict, status_error: Exception | None = None):
        self._payload = payload
        self._status_error = status_error

    def raise_for_status(self) -> None:
        if self._status_error is not None:
            raise self._status_error

    def json(self) -> dict:
        return self._payload


def test_fetch_vef_rate_parses_the_promedio_field(monkeypatch):
    monkeypatch.setattr(
        httpx,
        "get",
        lambda *a, **kw: _FakeResponse({"moneda": "USD", "fuente": "oficial", "promedio": 801.1752}),
    )

    rate = fetch_vef_rate()

    assert rate == Decimal("801.1752")


def test_fetch_vef_rate_hits_dolarapi_without_any_app_id_or_key(monkeypatch):
    """A diferencia de fetch_fiat_rates (Open Exchange Rates), no hay ninguna key que
    configurar - pedido explícito del usuario. Siempre intenta la llamada real."""
    captured = {}

    def _fake_get(url, timeout):
        captured["url"] = url
        return _FakeResponse({"promedio": 800})

    monkeypatch.setattr(httpx, "get", _fake_get)

    fetch_vef_rate()

    assert captured["url"] == "https://ve.dolarapi.com/v1/dolares/oficial"


def test_fetch_vef_rate_falls_back_on_a_network_error(monkeypatch):
    def _raise(*a, **kw):
        raise httpx.ConnectError("no hay conexión")

    monkeypatch.setattr(httpx, "get", _raise)

    rate = fetch_vef_rate()

    assert rate == Decimal("36.5")


def test_fetch_vef_rate_falls_back_on_an_http_error_status(monkeypatch):
    monkeypatch.setattr(
        httpx,
        "get",
        lambda *a, **kw: _FakeResponse({}, status_error=httpx.HTTPStatusError("500", request=None, response=None)),
    )

    rate = fetch_vef_rate()

    assert rate == Decimal("36.5")


def test_fetch_vef_rate_falls_back_on_a_malformed_response(monkeypatch):
    # Sin el campo "promedio" esperado - servicio gratuito sin SLA, un cambio de forma
    # en la respuesta no debe tumbar cualquier conversión que involucre VEF.
    monkeypatch.setattr(httpx, "get", lambda *a, **kw: _FakeResponse({"algo": "distinto"}))

    rate = fetch_vef_rate()

    assert rate == Decimal("36.5")
