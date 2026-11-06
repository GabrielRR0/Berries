import type { ScanRow } from './movementRows'

// Aviso que deja withDefaultDate (rowsFromImage.ts) cuando la captura no traia fecha.
const DEFAULT_DATE_FLAG = 'La captura no muestra la fecha: se usó la elegida al subir.'

function stampKey(row: ScanRow): string | null {
  return row.stamp ? `${row.currency ?? ''}|${row.direction}|${row.amount.toFixed(2)}|${row.stamp}` : null
}

// Una orden P2P se reconoce por su importe en moneda local y sus USDT (105,18 USDT por $108).
function p2pKey(row: ScanRow): string | null {
  return row.p2p ? `${row.currency ?? ''}|${row.direction}|${row.amount.toFixed(2)}|${row.p2p.usdt.toFixed(2)}` : null
}

function mergeStamped(match: ScanRow, row: ScanRow): void {
  match.reference = match.reference ?? row.reference
  // La descripcion mas larga es la del detalle (trae la nota).
  if (row.description.length > match.description.length) match.description = row.description
}

// El historial de ordenes trae fecha, numero y contraparte; el detalle de la orden no, pero trae el
// metodo de pago. Se juntan en una sola fila con lo mejor de cada una.
function mergeP2p(match: ScanRow, row: ScanRow): void {
  const a = match.p2p!
  const b = row.p2p!
  const matchHasRealDate = !match.flags.includes(DEFAULT_DATE_FLAG)
  const rowHasRealDate = !row.flags.includes(DEFAULT_DATE_FLAG)
  if (!matchHasRealDate && rowHasRealDate && row.occurredOn) {
    match.occurredOn = row.occurredOn
    match.time = row.time
    match.flags = match.flags.filter((flag) => flag !== DEFAULT_DATE_FLAG)
  }
  a.orderNumber = a.orderNumber ?? b.orderNumber
  a.counterparty = a.counterparty ?? b.counterparty
  a.paymentMethod = a.paymentMethod ?? b.paymentMethod
  a.price = a.price ?? b.price
  match.reference = match.reference ?? row.reference
  match.description = ['Binance P2P', a.counterparty, a.paymentMethod].filter(Boolean).join(' · ')
  for (const flag of row.flags) {
    if (flag !== DEFAULT_DATE_FLAG && !match.flags.includes(flag)) match.flags.push(flag)
  }
}

// El mismo movimiento puede llegar en dos capturas:
//  - la lista de Binance Pay y su "Detalles del pago": misma hora al segundo, sentido y monto;
//  - el historial de ordenes P2P y el "Detalles de la orden": mismo importe y mismos USDT. Solo se
//    unen si a una de las dos le falta el numero de orden (el detalle no lo muestra); dos ordenes
//    con numero distinto son dos ordenes aunque coincidan los montos.
// No se agrega otra fila: se completa la existente con lo que solo trae la otra captura.
// Devuelve las filas nuevas que si hay que agregar; modifica las existentes en el lugar.
export function mergeRepeatedRows(existing: ScanRow[], incoming: ScanRow[]): ScanRow[] {
  const byStamp = new Map<string, ScanRow>()
  const byOrder = new Map<string, ScanRow[]>()
  for (const row of existing) {
    const stamp = stampKey(row)
    if (stamp) byStamp.set(stamp, row)
    const order = p2pKey(row)
    if (order) byOrder.set(order, [...(byOrder.get(order) ?? []), row])
  }

  const added: ScanRow[] = []
  for (const row of incoming) {
    const stamp = stampKey(row)
    const stampMatch = stamp ? byStamp.get(stamp) : undefined
    if (stampMatch) {
      mergeStamped(stampMatch, row)
      continue
    }

    const order = p2pKey(row)
    const candidates = (order ? byOrder.get(order) : undefined) ?? []
    const orderMatch = candidates.filter((other) => !other.p2p!.orderNumber || !row.p2p!.orderNumber)
    if (orderMatch.length === 1) {
      mergeP2p(orderMatch[0]!, row)
      continue
    }

    added.push(row)
    if (stamp) byStamp.set(stamp, row)
    if (order) byOrder.set(order, [...(byOrder.get(order) ?? []), row])
  }
  return added
}
