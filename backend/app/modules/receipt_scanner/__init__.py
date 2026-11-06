"""Lectura de recibos por foto (OCR) que termina en un borrador de movimiento.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.receipt_scanner.controllers import receipt_scanner_routers

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
