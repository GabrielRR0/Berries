# USDT es una stablecoin atada 1:1 al dolar - pedido explicito del usuario ("100$
# equivale siempre a 100 usdt y viceversa"). Extraido de debt_payment_service.py (que
# tenia esta misma constante en local) para que goals/wallet_commitment_service.py
# tambien lo use, en vez de duplicar el set - pedido explicito del usuario: "si es
# dolares, acepte dolares y usdt" tambien para enlazar un aporte de meta a una
# billetera.
USD_PEGGED_CURRENCIES = {"USD", "USDT"}


def currencies_are_equivalent(a: str, b: str) -> bool:
    """True si son la misma moneda, o si ambas son parte del par USD/USDT (atado 1:1,
    nunca necesita conversion manual)."""
    return a == b or (a in USD_PEGGED_CURRENCIES and b in USD_PEGGED_CURRENCIES)
