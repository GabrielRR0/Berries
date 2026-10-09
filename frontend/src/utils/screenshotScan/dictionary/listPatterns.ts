// Piezas de una lista de movimientos del banco: los montos ("22.848,00 Bs") y las
// horas ("10:25 PM") son las anclas de cada fila.

// Un segmento que es SOLO un monto en bolivares (con o sin simbolo a cada lado).
export const LIST_AMOUNT_PATTERN = /^[-+]?\s*(?:(?:bs|ves|vef)\.?\s*)?(\d[\d.,]*)\s*(?:bs|ves|vef)?\.?$/i
// El segmento debe mencionar la moneda para no confundir un monto con cualquier numero.
export const LIST_HAS_CURRENCY = /\b(?:bs|ves|vef)\b|bs\.?\s*\d|\d\s*bs\b/i
export const LIST_TIME_PATTERN = /^\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?$/i

// Codigo de moneda que se asigna a los montos de la lista.
export const LIST_CURRENCY = 'VEF'
