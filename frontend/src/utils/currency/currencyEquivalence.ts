// USDT es una stablecoin atada 1:1 al dolar - pedido explicito del usuario ("100$
// equivale siempre a 100 usdt y viceversa"), mismo criterio ya establecido en
// AddDebtPaymentForm.vue (y su espejo en debt_payment_service.py/
// pegged_currencies.py del backend). Extraido a un util compartido para que Metas
// tambien lo use al filtrar billeteras para enlazar un aporte - pedido explicito
// del usuario: "en billetera no me deja usar usdt, seria bueno que si es dolares,
// acepte dolares y usdt".
const USD_PEGGED_CURRENCIES = new Set(['USD', 'USDT'])

export function currenciesAreEquivalent(a: string, b: string): boolean {
  return a === b || (USD_PEGGED_CURRENCIES.has(a) && USD_PEGGED_CURRENCIES.has(b))
}
