import { DOLLAR_PRICE_RANGE, DOLLAR_SIGN, FIAT_SYMBOLS, MAX_DOLLAR_PRICE } from './dictionary/fiatSymbols'

// Codigo de Berry de la moneda local de una orden P2P, a partir del texto del importe o del
// precio ("Bs6.800", "$30") y del precio del USDT. Null si no se puede saber sin adivinar.
export function fiatCurrencyOf(rawTexts: (string | null)[], unitPrice: number | null): string | null {
  // Separa el simbolo pegado al numero ("Bs6.800" -> "Bs 6.800") para que \b funcione.
  const text = rawTexts
    .filter((raw): raw is string => raw !== null)
    .join(' ')
    .toLowerCase()
    .replace(/([^\d\s.,])(\d)/g, '$1 $2')

  for (const { pattern, currency } of FIAT_SYMBOLS) {
    if (pattern.test(text)) return currency
  }
  if (DOLLAR_SIGN.test(text)) return unitPrice === null || unitPrice <= MAX_DOLLAR_PRICE ? 'USD' : null
  if (unitPrice !== null && unitPrice >= DOLLAR_PRICE_RANGE.min && unitPrice <= DOLLAR_PRICE_RANGE.max) return 'USD'
  return null
}
