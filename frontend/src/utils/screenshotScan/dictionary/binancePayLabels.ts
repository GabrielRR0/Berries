// Binance Pay: envios y recibos de cripto entre usuarios (no son P2P). Dos pantallas:
//  - la lista "Activos > Pay": por movimiento, "Pay -40 USDT" / "Enviar criptos User-aa8bc" /
//    "2026-10-31 19:48:46";
//  - "Detalles del pago" de uno: "+153 USDT", "De"/"A" la contraparte, "Nota", "Hora", "Id. de orden".
// Texto en minusculas y sin tildes.

// Monto con signo y moneda: "-40 USDT", "+150 USDT" (en la lista va despues de "Pay").
// El OCR puede leer el signo menos como guion largo.
export const PAY_AMOUNT = /^(?:pay\s+)?([+\-−–—])?\s*(\d[\d.,]*)\s*usdt$/
export const PAY_LIST_ITEM_GLOBAL = /(?:^|\n)\s*pay\s+[+\-−–—]?\s*\d[\d.,]*\s*usdt\b/g
// Cuantos movimientos deben aparecer para tomar la captura como lista de Pay.
export const MIN_PAY_LIST_ITEMS = 2

// Segunda linea de cada movimiento de la lista: el tipo y la contraparte.
export const PAY_SENT = /^(enviar criptos?|send crypto|sent)\b/
export const PAY_RECEIVED = /^(recibir criptos?|receive crypto|received)\b/

// Fecha y hora completas, con segundos: "2026-10-31 19:48:46".
export const PAY_STAMP = /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}):(\d{2})/

export const PAY_DETAIL_LABELS = {
  from: /^(de|from)\s/,
  to: /^(a|to)\s/,
  note: /^(nota|note)\b/,
  time: /^(hora|time)\b/,
  // El OCR lee "Id." como "1d." o "ld.".
  orderId: /^[il1]d\.?\s*de orden|^order id/,
  // "Pagado con 270 USDT" (solo en un envio): el mismo monto del encabezado. Respaldo para cuando
  // el OCR no lee el numero grande del encabezado.
  paidWith: /^(pagado con|paid with)\b/,
}

// Que la diferencia de un comprobante de banco: titulo y frases propias de Pay.
export const PAY_DETAIL_TITLE = /detalles del pago|payment details/
export const PAY_DETAIL_PHRASES = /se han enviado criptomonedas|criptomonedas enviadas|pagado con|paid with|crypto (sent|received)/
