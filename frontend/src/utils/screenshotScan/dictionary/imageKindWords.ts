// Como se distingue una lista (de movimientos o de ordenes) de un movimiento suelto,
// mirando todo el texto de la captura (minusculas y sin tildes).

// Inicio de una orden P2P ("Vender USDT"); varias en una captura = historial de ordenes.
export const ORDER_START_GLOBAL = /\b(vender|comprar|sell|buy)\s+usdt\b/g
export const ORDER_HISTORY_TITLE = /historial de ordenes|order history/

// Horas ("10:25 PM") y montos en bolivares ("22.848,00 Bs"): varias de cada una = lista del banco.
export const TIME_OF_DAY_GLOBAL = /\b\d{1,2}:\d{2}\s*[ap]\.?\s?m\b/g
export const BOLIVAR_AMOUNT_GLOBAL = /\d[\d.,]*\s*bs\b/g

// Cuantas veces deben aparecer para considerarlo una lista.
export const MIN_LIST_TIMES = 2
export const MIN_LIST_AMOUNTS = 2
export const MIN_ORDER_STARTS = 2
