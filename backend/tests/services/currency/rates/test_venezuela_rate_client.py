from datetime import date
from decimal import Decimal

import httpx

from app.services.currency.rates.venezuela_rate_client import fetch_vef_rate, fetch_vef_rate_history


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

    rate, is_estimated = fetch_vef_rate()

    assert rate == Decimal("801.1752")
    assert is_estimated is False


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

    rate, is_estimated = fetch_vef_rate()

    assert rate == Decimal("36.5")
    assert is_estimated is True


def test_fetch_vef_rate_falls_back_on_an_http_error_status(monkeypatch):
    monkeypatch.setattr(
        httpx,
        "get",
        lambda *a, **kw: _FakeResponse({}, status_error=httpx.HTTPStatusError("500", request=None, response=None)),
    )

    rate, is_estimated = fetch_vef_rate()

    assert rate == Decimal("36.5")
    assert is_estimated is True


def test_fetch_vef_rate_falls_back_on_a_malformed_response(monkeypatch):
    # Sin el campo "promedio" esperado - servicio gratuito sin SLA, un cambio de forma
    # en la respuesta no debe tumbar cualquier conversión que involucre VEF.
    monkeypatch.setattr(httpx, "get", lambda *a, **kw: _FakeResponse({"algo": "distinto"}))

    rate, is_estimated = fetch_vef_rate()

    assert rate == Decimal("36.5")
    assert is_estimated is True


# --- fetch_vef_rate_history (pedido explicito del usuario: "buscar registros
# anteriores... de hace un año para acá") -------------------------------------------


def test_fetch_vef_rate_history_parses_date_and_promedio_per_entry(monkeypatch):
    payload = [
        {"fuente": "oficial", "compra": None, "venta": None, "promedio": 17.5591, "fecha": "2023-01-03"},
        {"fuente": "oficial", "compra": None, "venta": None, "promedio": 850.1234, "fecha": "2026-09-22"},
    ]
    monkeypatch.setattr(httpx, "get", lambda *a, **kw: _FakeResponse(payload))

    history = fetch_vef_rate_history()

    assert history == [
        (date(2023, 1, 3), Decimal("17.5591")),
        (date(2026, 9, 22), Decimal("850.1234")),
    ]


def test_fetch_vef_rate_history_skips_entries_without_a_promedio(monkeypatch):
    payload = [
        {"fuente": "oficial", "compra": None, "venta": None, "promedio": None, "fecha": "2023-01-01"},
        {"fuente": "oficial", "compra": None, "venta": None, "promedio": 800.0, "fecha": "2023-01-02"},
    ]
    monkeypatch.setattr(httpx, "get", lambda *a, **kw: _FakeResponse(payload))

    history = fetch_vef_rate_history()

    assert history == [(date(2023, 1, 2), Decimal("800.0"))]


def test_fetch_vef_rate_history_hits_the_historical_endpoint(monkeypatch):
    captured = {}

    def _fake_get(url, timeout):
        captured["url"] = url
        return _FakeResponse([])

    monkeypatch.setattr(httpx, "get", _fake_get)

    fetch_vef_rate_history()

    assert captured["url"] == "https://ve.dolarapi.com/v1/historicos/dolares/oficial"


def test_fetch_vef_rate_history_propagates_errors_without_a_fallback(monkeypatch):
    import pytest

    def _raise(*a, **kw):
        raise httpx.ConnectError("no hay conexión")

    monkeypatch.setattr(httpx, "get", _raise)

    with pytest.raises(httpx.ConnectError):
        fetch_vef_rate_history()
