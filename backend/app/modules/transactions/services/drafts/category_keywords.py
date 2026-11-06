"""Palabras/frases gatillo por categoría por defecto (ver la migración
202608280003_seed_default_categories.py, que crea estas mismas categorías con
user_id=None) - usado por entity_parser.py para sugerir una categoría a partir del
texto libre de un dictado por voz. Coincidencia por substring, no difusa (a diferencia
de personal_vocabulary.py, que corrige palabras mal transcritas contra el vocabulario
REAL del usuario): frases como "hice una vaca" no tienen ninguna similitud de texto con
"Salidas", así que la única forma de conectarlas es una lista curada a mano, no una
distancia de edición.

Solo cubre categorías POR DEFECTO (nunca las que un usuario se creó, que son
impredecibles) - primer match gana, en el orden de este dict. "Otros ingresos"/"Otros
gastos" quedan afuera a propósito: son el catch-all manual del selector, no algo que
tenga sentido "adivinar" - si nada matchea, la categoría queda sin sugerir y el usuario
elige a mano."""

DEFAULT_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Salario": ("salario", "sueldo", "cobré", "cobre", "nómina", "nomina", "me pagaron"),
    "Préstamos": ("préstamo", "prestamo", "me prestaron", "presté", "preste"),
    "Regalo": ("regalo", "me regalaron", "obsequio"),
    "Mercado": ("mercado", "super", "supermercado", "comida", "almuerzo", "compras del mes"),
    "Internet": ("internet", "wifi", "fibra"),
    "Gasolina": ("gasolina", "combustible", "gasoil"),
    "Gym": ("gym", "gimnasio"),
    "Ropa": ("ropa", "zapatos", "zapatillas", "camisa", "pantalón", "pantalon"),
    "Repuestos": ("repuesto", "repuestos", "taller", "mecánico", "mecanico"),
    "Antojos": ("antojo", "antojos", "dulce", "dulces", "chuchería", "chucheria", "golosina", "golosinas"),
    "Salidas": (
        "salida",
        "salidas",
        "salí con",
        "sali con",
        "vaca",
        "hice una vaca",
        "reunión de amigos",
        "reunion de amigos",
        "junta",
        "cita",
    ),
    "Servicios": ("servicios", "luz", "agua", "electricidad"),
}
