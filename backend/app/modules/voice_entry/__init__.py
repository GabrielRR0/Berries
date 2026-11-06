"""Registro por voz: corrige el texto dictado y lo convierte en borrador.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.voice_entry.services.correction.correction_service import correct_transcript

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
