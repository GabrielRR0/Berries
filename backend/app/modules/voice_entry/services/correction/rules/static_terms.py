"""Reglas GLOBALES (iguales para todos los usuarios) - solo terminos de marca/finanzas
de baja ambiguedad, donde la correccion es segura sin conocer nada del usuario (ej.
variantes de "USDT"/"Binance" que el Web Speech API en es-419 suele partir o
transcribir mal de forma predecible). Deliberadamente NO incluye nada como
"vaina"->"Binance": "vaina" es una palabra comun/ambigua del español, reemplazarla
siempre corromperia frases sin ninguna relacion - ese caso solo se resuelve con el
vocabulario personal del usuario (ver personal_vocabulary.py), y unicamente si el
usuario de verdad tiene una wallet/entidad con un nombre parecido."""

# (patron regex, reemplazo) - aplicados en orden, case-insensitive.
GLOBAL_TERM_RULES: list[tuple[str, str]] = [
    (r"\bu\s*s\s*d\s*t\b", "USDT"),
    (r"\bteter\b", "Tether"),
    (r"\bbinans\b", "Binance"),
    (r"\bvinance\b", "Binance"),
    (r"\bbanance\b", "Binance"),
]
