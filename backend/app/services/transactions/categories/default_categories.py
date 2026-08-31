"""Lista canónica de categorías por defecto (Category.user_id=None, compartidas por
todos los usuarios, no borrables - solo ocultables, ver hidden_category_model.py).
Vive en un solo lugar para que la migración que las siembra
(202608280003_seed_default_categories.py) y el fixture de tests
(tests/conftest.py, que no corre migraciones reales - solo Base.metadata.create_all())
nunca queden desincronizados entre sí."""

DEFAULT_CATEGORIES: list[tuple[str, str]] = [
    ("Salario", "income"),
    ("Préstamos", "income"),
    ("Regalo", "income"),
    ("Otros ingresos", "income"),
    ("Mercado", "expense"),
    ("Internet", "expense"),
    ("Gasolina", "expense"),
    ("Gym", "expense"),
    ("Ropa", "expense"),
    ("Repuestos", "expense"),
    ("Antojos", "expense"),
    ("Salidas", "expense"),
    ("Servicios", "expense"),
    ("Otros gastos", "expense"),
]
