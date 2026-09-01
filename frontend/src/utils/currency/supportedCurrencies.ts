export interface SupportedCurrency {
  code: string
  name: string
  symbol: string
  // Locale usado solo para el formato de agrupacion/decimales de
  // Intl.NumberFormat (ver formatCurrency.ts) - no determina el idioma de la UI.
  locale: string
}

// Fuente unica de las monedas que ofrece la app en selects (billeteras,
// conversor, metas) - antes cada componente tenia su propia lista repetida y
// ya habian empezado a desalinearse entre si (distinto orden/contenido en
// CreateWalletForm.vue vs CurrencyConverterCalculator.vue). Esto NO restringe
// que una deuda acepte otra moneda por texto libre (ver CreateDebtForm.vue) -
// esa es a proposito de texto libre, una deuda puede estar en cualquier
// moneda. Metas (CreateGoalWizard.vue/EditGoalForm.vue) SI quedan acotadas a
// esta lista via <select> (pedido explicito del usuario) - de todas formas el
// backend solo tiene cargadas estas 6 monedas (get_currency_by_code rechaza
// cualquier otra), asi que texto libre ahi solo invitaba a un error confuso.
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: 'USD', name: 'Dólar estadounidense', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'VEF', name: 'Bolívar', symbol: 'Bs', locale: 'es-VE' },
  { code: 'USDT', name: 'Tether (USDT)', symbol: 'USDT', locale: 'en-US' },
  { code: 'COP', name: 'Peso colombiano', symbol: '$', locale: 'es-CO' },
  { code: 'ARS', name: 'Peso argentino', symbol: '$', locale: 'es-AR' },
]
