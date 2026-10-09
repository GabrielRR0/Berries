import type { ScanRow } from './movementRows'

// Una venta P2P deja dos rastros: la orden en Binance (con los USDT) y el abono
// de los Bs en el banco (sin saber cuantos USDT fueron). Si el usuario sube
// ambas capturas, se enlazan por el importe en Bs y la cercania en el tiempo, y
// el abono queda como una transferencia USDT -> Bs ya completa.
const MAX_GAP_HOURS = 12
const AMOUNT_TOLERANCE = 0.01

function timestamp(row: ScanRow): number | null {
  if (!row.occurredOn) return null
  const [year, month, day] = row.occurredOn.split('-').map(Number)
  const [hours, minutes] = row.time ? row.time.split(':').map(Number) : [12, 0]
  return new Date(year!, month! - 1, day!, hours, minutes).getTime()
}

// Modifica las filas en el lugar y las devuelve. Cada abono se enlaza como mucho
// con una orden y viceversa; ante varias candidatas gana la mas cercana en hora.
export function matchP2pOrders(rows: ScanRow[]): ScanRow[] {
  const orders = rows.filter((row) => row.source === 'p2p_order' && row.p2p && row.linkedOrderNumber === null)
  const bankRows = rows.filter((row) => row.source === 'bank' && row.linkedOrderNumber === null)

  for (const order of orders) {
    const orderTime = timestamp(order)
    let best: ScanRow | null = null
    let bestGap = Infinity

    for (const bankRow of bankRows) {
      if (bankRow.linkedOrderNumber !== null) continue
      if (bankRow.direction !== order.direction) continue
      if (Math.abs(bankRow.amount - order.amount) > AMOUNT_TOLERANCE) continue

      const bankTime = timestamp(bankRow)
      if (orderTime === null || bankTime === null) {
        // Sin hora para comparar, el primero con el mismo importe sirve.
        if (best === null) best = bankRow
        continue
      }
      const gap = Math.abs(bankTime - orderTime)
      if (gap <= MAX_GAP_HOURS * 3_600_000 && gap < bestGap) {
        best = bankRow
        bestGap = gap
      }
    }

    if (best === null) continue
    const marker = order.p2p!.orderNumber ?? order.id
    best.action = 'transfer'
    best.sentAmount = order.p2p!.usdt
    best.linkedOrderNumber = marker
    best.reference = best.reference ?? order.reference
    best.flags = [...best.flags, `Enlazado con la orden P2P de ${order.p2p!.usdt} USDT.`]
    order.linkedOrderNumber = marker
  }
  return rows
}
