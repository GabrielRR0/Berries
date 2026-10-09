// Etiquetas de la pantalla "Detalles de la orden" de Binance P2P, en espanol e
// ingles. Se comparan al inicio de la linea, en minusculas y sin tildes. Si Binance
// cambia un texto o agrega un idioma, se edita aqui.
export const BINANCE_LABELS = {
  fiatAmount: /^(importe en fiat|fiat amount)\b/,
  unitPrice: /^(precio de usdt|precio|price)\b/,
  totalQuantity: /^(cantidad total|total quantity)\b/,
  releasedQuantity: /^(cantidad liberada|cantidad recibida|released quantity|received quantity)\b/,
  fee: /^(comision|fee|commission)\b/,
  createdAt: /^(hora de creacion|hora de la orden|creation time|created time|order time)\b/,
  orderNumber: /^(n\s*\.?\s*[º°o0]?\s*\.?\s*de orden|numero de orden|order (no\.?|number|id))/,
  // En pantallas angostas la etiqueta se parte en dos lineas ("Apodo del" /
  // "comprador Nelasurej"), por eso "comprador" es opcional aqui y se quita del valor.
  counterparty: /^(apodo del( (comprador|vendedor))?|(buyer|seller)'?s? nick ?name)/,
}

// "Vender USDT" / "Comprar USDT": los verbos que significan vender (el resto es comprar).
export const BINANCE_SELL_VERBS = ['vender', 'sell']

// Palabras que indican el idioma de la captura, para leer bien los numeros
// ("26.600" es 26600 en espanol y 26,6 en ingles).
export const SPANISH_LANGUAGE_PATTERN = /cantidad|importe|precio|comision|orden|comprador|vendedor/
