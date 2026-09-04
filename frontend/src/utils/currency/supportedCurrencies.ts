export interface SupportedCurrency {
  code: string
  name: string
  symbol: string
  // Locale usado solo para el formato de agrupacion/decimales de
  // Intl.NumberFormat (ver formatCurrency.ts) - no determina el idioma de la UI.
  locale: string
}

// Fuente unica de las monedas que ofrece la app en selects (billeteras,
// conversor, metas, deudas) - antes cada componente tenia su propia lista
// repetida y ya habian empezado a desalinearse entre si (distinto orden/
// contenido en CreateWalletForm.vue vs CurrencyConverterCalculator.vue).
// CreateDebtForm.vue tenia un campo de moneda de texto libre "a proposito"
// segun un comentario viejo aca, pero el backend SIEMPRE valido la moneda
// contra esta misma lista (get_currency_by_code rechaza cualquier otra,
// devuelve 400) - el texto libre solo invitaba al mismo error confuso que
// esta lista ya evita en Metas, nunca fue una libertad real. Se corrigio
// para usar este mismo <select>.
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: 'USD', name: 'Dólar estadounidense', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'VEF', name: 'Bolívar', symbol: 'Bs', locale: 'es-VE' },
  { code: 'USDT', name: 'Tether (USDT)', symbol: 'USDT', locale: 'en-US' },
  { code: 'COP', name: 'Peso colombiano', symbol: '$', locale: 'es-CO' },
  { code: 'ARS', name: 'Peso argentino', symbol: '$', locale: 'es-AR' },
]
