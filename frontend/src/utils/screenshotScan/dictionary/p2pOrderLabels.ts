// Etiquetas de cada tarjeta del "Historial de ordenes" de Binance P2P (al inicio de la
// linea, en minusculas y sin tildes).
export const P2P_ORDER_START = /^(vender|comprar|sell|buy)\s+usdt\b/
export const P2P_SELL_START = /^(vender|sell)/

export const P2P_ORDER_LABELS = {
  fiatAmount: /^(importe|fiat amount|monto)\b/,
  unitPrice: /^(precio|price)\b/,
  quantity: /^(cantidad total|total quantity|cantidad|quantity)\b/,
  orderNumber: /^(orden|order)\b/,
}

// Pie de la tarjeta: apodo de la contraparte y fecha de creacion "MM-DD hh:mm:ss" (sin ano).
export const P2P_FOOTER_STAMP = /(\d{1,2})-(\d{1,2})\s+(\d{2}:\d{2})(?::\d{2})?/
