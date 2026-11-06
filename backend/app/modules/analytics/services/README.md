# services/ — analytics

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

- **`category_breakdown.py`** — Gastos o ingresos por categoría: del mes y su evolución mes a mes.
- **`period_summary.py`** — Capa de agregación de solo lectura sobre `Transaction` (sección 3.7 de la spec: resúmenes financieros).
- **`period_totals.py`** — Piezas comunes de los cálculos: movimientos de un período y sumas convertidas a la moneda del usuario.
