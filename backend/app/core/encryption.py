"""Encriptación simétrica a nivel de columna para datos financieros (balances,
montos, categorías, descripciones, contraparte de deudas, texto crudo de voz/OCR) -
pedido explícito del usuario: ni un admin mirando la tabla directo debe poder ver
cuánto gastó/recibió un usuario ni su historial en texto plano.

Usa Fernet (cryptography.fernet: AES-128-CBC + HMAC, con IV aleatorio por valor) con
una única clave simétrica (MASTER_ENCRYPTION_KEY) - esto es "encriptado en reposo a
nivel de columna", no un sistema de KMS con rotación/versionado de claves (fuera de
alcance de este pedido). Como cada valor se encripta con un IV distinto, el mismo
texto plano da un ciphertext distinto cada vez - por eso el filtro/agregación por
categoría o monto ya NO puede hacerse en SQL (ver analytics_service.py y
transaction_service.py, que ahora traen las filas y filtran/suman en Python)."""

from decimal import Decimal
from functools import lru_cache

from cryptography.fernet import Fernet
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.config import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    return Fernet(settings.master_encryption_key.encode())


class EncryptedString(TypeDecorator):
    """Texto encriptado (categoria, descripcion, nombre de contraparte, texto crudo
    de voz/OCR). Columna subyacente Text, no String de largo fijo - un token Fernet
    pesa bastante más que el texto original."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return _fernet().encrypt(value.encode()).decode()

    def process_result_value(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return _fernet().decrypt(value.encode()).decode()


class EncryptedDecimal(TypeDecorator):
    """Monto encriptado (balance de wallet, amount de transaction/installment,
    total_amount de debt). Se guarda como texto cifrado, no Numeric - ya no se puede
    sumar/promediar del lado de SQL (ver analytics_service.py, que agrega en Python
    por esto mismo)."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Decimal | None, dialect) -> str | None:
        if value is None:
            return None
        return _fernet().encrypt(str(value).encode()).decode()

    def process_result_value(self, value: str | None, dialect) -> Decimal | None:
        if value is None:
            return None
        return Decimal(_fernet().decrypt(value.encode()).decode())
