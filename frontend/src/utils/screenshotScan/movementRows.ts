// Modelo comun de una fila de la pantalla de revision: lo que se leyo de la
// captura (monto, fecha, texto, si entro o salio dinero) mas lo que el usuario
// decide (que hacer con ella, categoria, billeteras). Lo mismo sirve para un
// movimiento suelto, una lista del banco o una lista de ordenes P2P.
export type RowAction = 'expense' | 'income' | 'transfer' | 'pending' | 'skip'
export type RowSource = 'bank' | 'p2p_order'
export type RowDirection = 'in' | 'out'

export interface P2POrderInfo {
  // USDT de la orden (la "cantidad total", comision incluida).
  usdt: number
  price: number | null
  orderNumber: string | null
  counterparty: string | null
}

export interface ScanRow {
  id: string
  source: RowSource
  // En la moneda de la captura (Bs en un banco venezolano). En una orden P2P es el importe en Bs.
  amount: number
  currency: string | null
  direction: RowDirection
  // YYYY-MM-DD en hora local; null si no se pudo saber.
  occurredOn: string | null
  // HH:mm en 24 horas; null si no aparece.
  time: string | null
  description: string
  reference: string | null
  // Comision cobrada junto con el movimiento (ya sumada a la fila, no es otra fila).
  fee: number
  // Avisos de lo que se infirio y conviene revisar.
  flags: string[]
  action: RowAction
  category: string
  // Billetera donde ocurrio el movimiento (gasto/ingreso/pendiente).
  walletId: string
  // Solo para action === 'transfer'.
  fromWalletId: string
  toWalletId: string
  // Lo que salio de la billetera origen (ej. USDT enviados). Null si no se sabe.
  sentAmount: number | null
  p2p: P2POrderInfo | null
  // Numero de la orden P2P con la que se enlazo este recibido (ver matchP2pOrders.ts).
  linkedOrderNumber: string | null
}

let rowCounter = 0

export function newRowId(): string {
  rowCounter += 1
  return `row-${rowCounter}`
}

export function makeRow(partial: Partial<ScanRow> & Pick<ScanRow, 'source' | 'amount' | 'direction'>): ScanRow {
  return {
    id: newRowId(),
    currency: null,
    occurredOn: null,
    time: null,
    description: '',
    reference: null,
    fee: 0,
    flags: [],
    action: partial.direction === 'in' ? 'income' : 'expense',
    category: '',
    walletId: '',
    fromWalletId: '',
    toWalletId: '',
    sentAmount: null,
    p2p: null,
    linkedOrderNumber: null,
    ...partial,
  }
}

// "10:25 PM" -> "22:25", "21:55:19" -> "21:55". Null si no es una hora valida.
export function to24h(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?\.?$/i)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toLowerCase()
  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    if (meridiem === 'p' && hours !== 12) hours += 12
    if (meridiem === 'a' && hours === 12) hours = 0
  }
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// Fecha + hora locales a ISO (lo que espera el backend). Sin hora usa la actual, igual
// que los formularios de movimiento y transferencia.
export function buildOccurredAt(date: string, time: string | null): string {
  const [year, month, day] = date.split('-').map(Number)
  const now = new Date()
  const [hours, minutes] = time ? time.split(':').map(Number) : [now.getHours(), now.getMinutes()]
  return new Date(year!, month! - 1, day!, hours, minutes, time ? 0 : now.getSeconds()).toISOString()
}
