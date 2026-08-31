"""Regresión del choque de puertos real que se dio en desarrollo: un vite dev server
en un puerto distinto de 5173 (porque otro proyecto hermano del portafolio ya lo tenía
ocupado) debía poder loguearse igual — ni OriginCheckMiddleware ni CORS se probaban
antes con un header Origin real (TestClient no lo manda si no se lo pasa explícito),
así que este bug pasó desapercibido hasta probarlo en un navegador de verdad."""

from app.config import settings


class TestOriginCheckMiddleware:
    def test_allows_any_localhost_port_in_dev(self, client):
        response = client.get("/api/health", headers={"Origin": "http://localhost:5174"})
        assert response.status_code == 200

    def test_allows_127_0_0_1_in_dev(self, client):
        response = client.get("/api/health", headers={"Origin": "http://127.0.0.1:5999"})
        assert response.status_code == 200

    def test_rejects_non_localhost_origin_in_dev(self, client):
        response = client.get("/api/health", headers={"Origin": "https://evil.example.com"})
        assert response.status_code == 403
        assert response.json()["detail"] == "Origen no permitido"

    # Regresión real: probar Berry desde el teléfono vía túnel público
    # (cloudflared/localtunnel, ver LOCAL_ORIGIN_PATTERN) devolvía "Origen no
    # permitido" porque el navegador manda su Origin real del túnel incluso
    # pasando por el proxy /api de Vite.
    def test_allows_trycloudflare_tunnel_origin_in_dev(self, client):
        response = client.get(
            "/api/health", headers={"Origin": "https://motorola-pierre-tri-involved.trycloudflare.com"}
        )
        assert response.status_code == 200

    def test_allows_localtunnel_origin_in_dev(self, client):
        response = client.get("/api/health", headers={"Origin": "https://berry-gabri-test.loca.lt"})
        assert response.status_code == 200

    def test_rejects_lookalike_tunnel_domain_in_dev(self, client):
        response = client.get(
            "/api/health", headers={"Origin": "https://trycloudflare.com.evil.example.com"}
        )
        assert response.status_code == 403

    def test_requests_without_origin_header_pass_through(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_production_requires_exact_frontend_url_match(self, client, monkeypatch):
        # A diferencia de CORS (ver más abajo), esta capa evalúa settings en cada
        # request, así que monkeypatch sí la afecta en caliente.
        monkeypatch.setattr(settings, "environment", "production")
        monkeypatch.setattr(settings, "frontend_url", "https://berry.example.com")

        rejected = client.get("/api/health", headers={"Origin": "http://localhost:5174"})
        assert rejected.status_code == 403

        allowed = client.get("/api/health", headers={"Origin": "https://berry.example.com"})
        assert allowed.status_code == 200


class TestCorsPreflight:
    """CORSMiddleware queda configurado una sola vez cuando se importa app.main (no
    reevalúa settings.environment por request), así que solo se prueba el modo dev
    real de este proceso de test — el modo producción de CORS específicamente queda
    cubierto indirectamente por OriginCheckMiddleware arriba, que sí es estricto ahí."""

    def test_preflight_allows_any_localhost_port_in_dev(self, client):
        response = client.options(
            "/api/auth/login",
            headers={
                "Origin": "http://localhost:5174",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:5174"

    def test_preflight_rejects_non_localhost_origin_in_dev(self, client):
        response = client.options(
            "/api/auth/login",
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert "access-control-allow-origin" not in response.headers
