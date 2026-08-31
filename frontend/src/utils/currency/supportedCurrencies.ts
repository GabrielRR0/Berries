export interface SupportedCurrency {
  code: string
  name: string
  symbol: string
  // Locale usado solo para el formato de agrupacion/decimales de
  // Intl.NumberFormat (ver formatCurrency.ts) - no determina el idioma de la UI.
  locale: string
}

// Fuente unica de las monedas que ofrece la app en selects (billeteras,
// conversor) - antes cada componente tenia su propia lista repetida y ya
// habian empezado a desalinearse entre si (distinto orden/contenido en
// CreateWalletForm.vue vs CurrencyConverterCalculator.vue). Esto NO restringe
// que monto/deuda acepten otras monedas por texto libre (ver CreateDebtForm.vue/
// CreateGoalWizard.vue) - esas son a proposito de texto libre, una deuda puede
// estar en cualquier moneda, no solo en las que la app ofrece para billeteras.
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: 'USD', name: 'Dólar estadounidense', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'VEF', name: 'Bolívar', symbol: 'Bs', locale: 'es-VE' },
  { code: 'USDT', name: 'Tether (USDT)', symbol: 'USDT', locale: 'en-US' },
  { code: 'COP', name: 'Peso colombiano', symbol: '$', locale: 'es-CO' },
  { code: 'ARS', name: 'Peso argentino', symbol: '$', locale: 'es-AR' },
]
