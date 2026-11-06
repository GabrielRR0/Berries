"""Encriptación simétrica a nivel de columna para datos financieros (balances,
montos, categorías, descripciones, contraparte de deudas, texto crudo de voz/OCR) -
pedido explícito del usuario: ni un admin mirando la tabla directo debe poder ver
cuánto gastó/recibió un usuario ni su historial en texto plano.

Usa Fernet (vía app/support/crypto_support: AES-128-CBC + HMAC, con IV aleatorio por valor) con
una única clave simétrica (MASTER_ENCRYPTION_KEY) - esto es "encriptado en reposo a
nivel de columna", no un sistema de KMS con rotación/versionado de claves (fuera de
alcance de este pedido). Como cada valor se encripta con un IV distinto, el mismo
texto plano da un ciphertext distinto cada vez - por eso el filtro/agregación por
categoría o monto ya NO puede hacerse en SQL (ver analytics/services/ y
transactions/services/ledger/, que ahora traen las filas y filtran/suman en Python)."""

from decimal import Decimal
from functools import lru_cache

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.config import settings
from app.support.crypto_support import Cipher


@lru_cache(maxsize=1)
def _cipher() -> Cipher:
    return Cipher(settings.master_encryption_key)


class EncryptedString(TypeDecorator):
    """Texto encriptado (categoria, descripcion, nombre de contraparte, texto crudo
    de voz/OCR). Columna subyacente Text, no String de largo fijo - un token Fernet
    pesa bastante más que el texto original."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return _cipher().encrypt(value)

    def process_result_value(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return _cipher().decrypt(value)


class EncryptedDecimal(TypeDecorator):
    """Monto encriptado (balance de wallet, amount de transaction/installment,
    total_amount de debt). Se guarda como texto cifrado, no Numeric - ya no se puede
    sumar/promediar del lado de SQL (ver analytics/services/, que agrega en Python
    por esto mismo)."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Decimal | None, dialect) -> str | None:
        if value is None:
            return None
        return _cipher().encrypt(str(value))

    def process_result_value(self, value: str | None, dialect) -> Decimal | None:
        if value is None:
            return None
        return Decimal(_cipher().decrypt(value))
