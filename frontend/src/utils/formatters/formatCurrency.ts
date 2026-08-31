import { SUPPORTED_CURRENCIES } from '../currency/supportedCurrencies'

// Derivado de SUPPORTED_CURRENCIES (fuente unica) - una moneda que no esta en
// esa lista (ej. una deuda en una moneda menos comun, texto libre) simplemente
// cae al fallback de mas abajo, no rompe nada.
const CURRENCY_LOCALES: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency.locale]),
)

export function formatCurrency(amount: number, currency: string): string {
  // USDT no es una moneda ISO-4217 real - Intl.NumberFormat la rechaza, asi
  // que se formatea a mano con el simbolo pegado al numero.
  if (currency === 'USDT') {
    return `${amount.toFixed(2)} USDT`
  }

  try {
    return new Intl.NumberFormat(CURRENCY_LOCALES[currency] ?? 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Moneda desconocida que Intl tampoco reconoce - mismo fallback que USDT.
    return `${amount.toFixed(2)} ${currency}`
  }
}
