# common/modules/

`public_api()` arma la API pública de un módulo a partir de los imports que su
`__init__.py` declara dentro de `if TYPE_CHECKING:`. El editor los ve como imports
normales, pero en ejecución cada nombre se carga recién cuando alguien lo pide.

Es perezoso a propósito: hay dominios que se usan entre sí (wallets ↔ transactions,
currency ↔ wallets) y un `__init__.py` que importara todo al cargarse rompería el
arranque con imports circulares. Detalle en el docstring de `public_api.py`.
