# http_support/

`get(url, **kwargs)` y `post(url, **kwargs)`, más `HttpError` / `HttpStatusError` para
atrapar fallos de red o de estado. Son los mismos tipos de httpx (re-exportados) para que
las pruebas que simulan `httpx.ConnectError` sigan funcionando.

`get`/`post` buscan `httpx.get`/`httpx.post` en cada llamada, así las pruebas pueden
reemplazarlos con `monkeypatch.setattr(httpx, "get", ...)`.
