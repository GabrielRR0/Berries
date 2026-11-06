from datetime import timedelta
from decimal import Decimal

# Una tasa nueva no puede apartarse de golpe de la ultima real: un valor disparatado (un respaldo viejo, un
# error del proveedor, una inversion de direccion) no debe guardarse como si fuera dato de mercado.
#
# El limite se mide como razon (nueva / ultima real), asi es simetrico ante la inversion: la tasa VEF->USD
# (0,00114) y la USD->VEF (875) son la misma situacion mirada al reves y se juzgan igual. Y crece con el
# tiempo transcurrido, porque una moneda con inflacion fuerte se mueve mas en dos semanas que en dos dias.
BASE_MAX_RATIO = Decimal("1.25")
EXTRA_RATIO_PER_DAY = Decimal("0.01")
# Pasado este tiempo la ultima lectura ya no es comparable (la moneda pudo moverse mucho): no se juzga.
MAX_COMPARABLE_AGE = timedelta(days=30)


def is_plausible_change(new_rate: Decimal, reference_rate: Decimal | None, age: timedelta | None = None) -> bool:
    """True si `new_rate` es una continuacion razonable de `reference_rate` (la ultima lectura real del mismo par),
    leida hace `age`. Sin referencia no hay nada con que comparar y se acepta (salvo un valor no positivo)."""
    if new_rate <= 0:
        return False
    if reference_rate is None or reference_rate <= 0:
        return True
    if age is not None and age > MAX_COMPARABLE_AGE:
        return True

    days = Decimal(age.days) if age is not None else Decimal(0)
    max_ratio = BASE_MAX_RATIO + EXTRA_RATIO_PER_DAY * days
    ratio = new_rate / reference_rate
    return (Decimal(1) / max_ratio) <= ratio <= max_ratio
