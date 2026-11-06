import httpx

# Mismos tipos que httpx: quien atrapa `HttpError` atrapa cualquier fallo de red o de
# estado. Se re-exportan (en vez de traducirlos) para que las pruebas que simulan un
# `httpx.ConnectError` sigan comportándose igual.
HttpError = httpx.HTTPError
HttpStatusError = httpx.HTTPStatusError


def get(url: str, **kwargs) -> httpx.Response:
    # `httpx.get` se busca en cada llamada (no se guarda una referencia al importar),
    # así las pruebas pueden reemplazarlo con `monkeypatch.setattr(httpx, "get", ...)`.
    return httpx.get(url, **kwargs)


def post(url: str, **kwargs) -> httpx.Response:
    return httpx.post(url, **kwargs)
