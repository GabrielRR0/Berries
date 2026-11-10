# services/ — analytics

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

- **`category_breakdown.py`** — Gastos o ingresos por categoría: del mes y su evolución mes a mes.
- **`period_summary.py`** — Capa de agregación de solo lectura sobre `Transaction` (sección 3.7 de la spec: resúmenes financieros).
- **`period_totals.py`** — Piezas comunes de los cálculos: movimientos de un período y sumas convertidas a la moneda del usuario.
- **`insight_rules.py`** — Reglas de las recomendaciones: funciones puras, sin base de datos, fáciles de probar.
- **`insights.py`** — Recomendaciones sobre el gasto del mes, calculadas contra el historial del propio usuario.
- **`period_comparison.py`** — Gasto por categoría de un mes frente a otro tramo equivalente (mes pasado, año pasado o promedio).
- **`spending_patterns.py`** — Cuándo se gasta: gasto por día, promedio por día de la semana y peso del fin de semana.
- **`timeline.py`** — Ingresos y gastos por día, semana o mes dentro de un rango de fechas.
- **`top_transactions.py`** — Los movimientos más grandes de un mes.
- **`wallet_breakdown.py`** — Cuánto se movió en cada billetera durante un mes.
