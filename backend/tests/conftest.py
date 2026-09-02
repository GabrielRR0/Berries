import os

# Env vars requeridas por Settings deben existir ANTES de importar cualquier módulo de
# app/ (config.py instancia Settings() al importarse) - via os.environ, no vía el .env
# real del dev (Settings usa env_file=".env", pero una env var de proceso le gana a lo
# que haya en ese archivo). Sin esto, los tests dependían por accidente de lo que cada
# dev tuviera en su propio backend/.env - en particular FAKE_DATA_MODE=true (dejado
# prendido en este repo para pruebas visuales locales) hacía que authenticate_user()
# devolviera siempre el usuario demo sin validar credenciales, rompiendo en silencio
# los tests de login/auth de quien lo tuviera así. Clave Fernet fija y dedicada a
# tests (no la de ningún .env real) para que master_encryption_key nunca dependa de
# que exista un .env local con una clave real - necesaria en CI, que no tiene ese
# archivo.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")
os.environ.setdefault("MASTER_ENCRYPTION_KEY", "2H-8GUYtz7lmoCEmjSgqIOzVbrOoRc6LMLNz31YPCwo=")
os.environ.setdefault("FAKE_DATA_MODE", "false")

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 — registra los modelos en Base.metadata
from app.core.database import Base
from app.core.deps import get_db
from app.core.rate_limit import limiter
from app.main import app
from app.models.currency.currency_model import Currency
from app.models.transactions.category_model import Category
from app.services.currency.supported_currencies import SUPPORTED_CURRENCIES
from app.services.transactions.categories.default_categories import DEFAULT_CATEGORIES

# StaticPool + sqlite:///:memory: comparten una única conexión en todo el proceso de
# test — sin esto, cada sesión nueva vería una base de datos en memoria vacía distinta.
test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def _reset_database():
    Base.metadata.create_all(test_engine)
    # Base.metadata.create_all() solo crea el esquema - a diferencia de `alembic
    # upgrade head` en la app real, no corre las migraciones de datos que siembran las
    # categorías por defecto (202608280003_seed_default_categories.py) ni las monedas
    # soportadas (ver *_create_currencies_table.py). Se replica acá para que los tests
    # vean el mismo estado "recién instalado" que un usuario real - Wallet/Debt/Goal/
    # User tienen FK NOT NULL a currencies, así que sin esto ningún test que cree uno
    # de esos podría insertar una fila.
    session = TestSessionLocal()
    try:
        session.add_all(Category(user_id=None, name=name, kind=kind) for name, kind in DEFAULT_CATEGORIES)
        session.add_all(
            Currency(code=code, name=name, symbol=symbol, locale=locale)
            for code, name, symbol, locale in SUPPORTED_CURRENCIES
        )
        session.commit()
    finally:
        session.close()
    yield
    Base.metadata.drop_all(test_engine)


@pytest.fixture(autouse=True)
def _mock_vef_rate(monkeypatch):
    """La tasa VEF real depende de un servicio externo sin key propia (dolarapi.com,
    siempre alcanzable - ver venezuela_rate_client.py), a diferencia de
    fetch_fiat_rates()/fetch_crypto_rates() que solo llaman de verdad una vez
    configurada una key y por default caen a un fallback determinístico en tests. Sin
    este mock, cualquier test que convierta VEF (aunque no lo pruebe a propósito)
    terminaría haciendo una llamada de red real - lento, no determinístico, y roto sin
    conexión (ej. en CI). Devuelve el mismo valor de respaldo documentado que el resto
    de los tests ya esperaban de VEF. Los tests de venezuela_rate_client.py que SÍ
    prueban el parseo real / el fallback ante error mockean httpx.get directamente,
    parcheando la función en su propio módulo - no dependen de este mock global."""
    monkeypatch.setattr("app.services.currency.rates.cache_refresh.fetch_vef_rate", lambda: Decimal("36.5"))
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # El limiter de slowapi es un contador en memoria de proceso, no forma parte de la
    # base de datos que _reset_database limpia — sin esto, tests acumulados de varios
    # dominios que registran usuarios repetidamente terminan pisando el límite de
    # /api/auth/register (10/minuto). Centralizado acá para que ningún archivo de test
    # nuevo tenga que acordarse de repetirlo.
    limiter.reset()
    yield


def _override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    """Sesión directa contra la misma base de test, para tests de services/ que no
    pasan por HTTP. Expuesta como fixture (no como import de módulo) para evitar que
    pytest cargue conftest.py dos veces bajo nombres distintos y termine con dos
    engines desincronizados."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
