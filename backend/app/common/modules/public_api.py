"""API pública perezosa para el `__init__.py` de cada módulo.

El `__init__.py` de un módulo es lo único que otros módulos pueden importar (como el
`index.ts` de proyectoAlquiler). Se escribe así:

    from typing import TYPE_CHECKING

    from app.common.modules import public_api

    if TYPE_CHECKING:
        from app.modules.wallets.errors import WalletNotFoundError
        from app.modules.wallets.models import Wallet

    __getattr__, __dir__, __all__ = public_api(__name__, __file__)

Los imports dentro de `if TYPE_CHECKING:` son la lista de lo exportado: el editor y
el chequeo de tipos los ven, pero Python no los ejecuta al importar el módulo.
`public_api` lee esa lista y carga cada nombre recién cuando alguien lo pide.

Por qué perezoso: hay dominios que se usan entre sí (una transferencia de wallets crea
movimientos de transactions, y un borrador de transactions puede confirmarse como
transferencia). Si cada `__init__.py` importara todo al cargarse, esos ciclos
romperían el arranque. Cargando a pedido, cada import trae solo el archivo que hace
falta, igual que antes de tener módulos.
"""

import ast
import importlib
from pathlib import Path


def _exports_from_type_checking_block(init_file: str) -> dict[str, tuple[str, str]]:
    tree = ast.parse(Path(init_file).read_text(encoding="utf-8"))
    exports: dict[str, tuple[str, str]] = {}
    for node in tree.body:
        if isinstance(node, ast.If) and ast.unparse(node.test) == "TYPE_CHECKING":
            for statement in node.body:
                if isinstance(statement, ast.ImportFrom) and statement.module:
                    for alias in statement.names:
                        exports[alias.asname or alias.name] = (statement.module, alias.name)
    return exports


def public_api(module_name: str, init_file: str):
    exports = _exports_from_type_checking_block(init_file)

    def __getattr__(name: str):
        if name not in exports:
            raise AttributeError(f"{module_name} no exporta {name!r} (ver su __init__.py)")
        source_module, source_name = exports[name]
        return getattr(importlib.import_module(source_module), source_name)

    def __dir__() -> list[str]:
        return sorted(exports)

    return __getattr__, __dir__, sorted(exports)
