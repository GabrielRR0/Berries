// USDT es una stablecoin atada 1:1 al dolar, nunca necesita conversion manual -
// mismo criterio ya establecido en AddDebtPaymentForm.vue (y su espejo en
// debt_payment_service.py/pegged_currencies.py del backend). Util compartido
// para que Metas tambien lo use al filtrar billeteras para enlazar un aporte.
const USD_PEGGED_CURRENCIES = new Set(['USD', 'USDT'])

export function currenciesAreEquivalent(a: string, b: string): boolean {
  return a === b || (USD_PEGGED_CURRENCIES.has(a) && USD_PEGGED_CURRENCIES.has(b))
}
