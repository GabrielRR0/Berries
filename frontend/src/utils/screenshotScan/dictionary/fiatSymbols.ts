// Como aparece la moneda local junto al importe de una orden P2P de Binance ("Bs6.800",
// "$30", "COP 50.000"). Se compara en minusculas. El orden importa: los codigos
// explicitos van antes que el "$" suelto, que es ambiguo (dolar, peso colombiano o argentino).
export const FIAT_SYMBOLS: { pattern: RegExp; currency: string }[] = [
  { pattern: /\b(bs|ves|vef)\b/, currency: 'VEF' },
  { pattern: /\bcop\b/, currency: 'COP' },
  { pattern: /\bars\b/, currency: 'ARS' },
  { pattern: /€|\beur\b/, currency: 'EUR' },
  { pattern: /\busd\b|us\$/, currency: 'USD' },
]

// "$" solo: es dolar si el precio del USDT ronda 1 (las billeteras en dolares como Zinli o
// Wally). Con un precio alto seria un peso y no se adivina cual.
export const DOLLAR_SIGN = /\$/
export const MAX_DOLLAR_PRICE = 5

// Sin simbolo legible (el OCR suele leer "$" como "S"): un precio en este rango solo puede
// ser una moneda atada al dolar.
export const DOLLAR_PRICE_RANGE = { min: 0.85, max: 1.2 }
