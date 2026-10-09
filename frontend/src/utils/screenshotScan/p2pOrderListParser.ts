import { CANCELLED_PATTERN } from './dictionary/statusWords'
import { P2P_FOOTER_STAMP, P2P_ORDER_LABELS, P2P_ORDER_START, P2P_SELL_START } from './dictionary/p2pOrderLabels'
import { makeRow, to24h } from './movementRows'
import type { ScanRow } from './movementRows'
import { parseLocalizedNumber } from './numbers'
import type { Segment } from './ocrLayout'
import { normalizeForMatch } from './textLines'

// "Historial de ordenes" de Binance P2P: una tarjeta por orden con el importe en
// moneda local, el precio, la cantidad de USDT, el numero de orden y, abajo, el
// apodo de la contraparte con la fecha (MM-DD hh:mm:ss, sin ano). Las etiquetas
// estan en dictionary/p2pOrderLabels.ts.

function numberAfter(line: string): number | null {
  const token = line.match(/\d[\d.,]*/)?.[0]
  return token ? parseLocalizedNumber(token, 'es') : null
}

// El ano no aparece: es el actual, o el anterior si la fecha caeria en el futuro
// (ej. una orden de diciembre vista en enero).
function resolveYear(month: number, day: number, today: Date): number {
  const candidate = new Date(today.getFullYear(), month - 1, day)
  return candidate > today ? today.getFullYear() - 1 : today.getFullYear()
}

// Apodo de la contraparte sin el ruido que el OCR agrega junto a el: el icono de chat se
// lee como un caracter suelto ("Nelasurej O") y la insignia de mensajes sin leer como un
// numero corto ("OikonomiaDigital 10").
function cleanCounterparty(raw: string): string | null {
  const tokens = raw
    .replace(/[^\p{L}\p{N}_.\-\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]!
    if (last.length === 1 || /^\d{1,3}$/.test(last)) tokens.pop()
    else break
  }
  return tokens.join(' ') || null
}

function linesOf(segments: Segment[]): string[] {
  const byLine = new Map<number, Segment[]>()
  for (const segment of segments) byLine.set(segment.line, [...(byLine.get(segment.line) ?? []), segment])
  return [...byLine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, parts]) =>
      [...parts]
        .sort((a, b) => a.x0 - b.x0)
        .map((part) => part.text)
        .join(' ')
        .trim(),
    )
}

export function parseP2pOrderList(segments: Segment[], today: Date): ScanRow[] {
  const lines = linesOf(segments)
  const blocks: string[][] = []
  for (const line of lines) {
    if (P2P_ORDER_START.test(normalizeForMatch(line))) blocks.push([line])
    else if (blocks.length > 0) blocks[blocks.length - 1]!.push(line)
  }

  const rows: ScanRow[] = []
  for (const block of blocks) {
    const normalized = block.map(normalizeForMatch)
    const header = normalized[0]!
    // Las ordenes canceladas o en apelacion no movieron dinero.
    if (CANCELLED_PATTERN.test(header)) continue

    const direction = P2P_SELL_START.test(header) ? 'in' : 'out'
    const find = (label: RegExp) => {
      const index = normalized.findIndex((line) => label.test(line))
      return index === -1 ? null : block[index]!
    }

    const fiatLine = find(P2P_ORDER_LABELS.fiatAmount)
    const priceLine = find(P2P_ORDER_LABELS.unitPrice)
    const quantityLine = find(P2P_ORDER_LABELS.quantity)
    const orderLine = find(P2P_ORDER_LABELS.orderNumber)

    const amount = fiatLine ? numberAfter(fiatLine) : null
    const usdt = quantityLine ? numberAfter(quantityLine) : null
    if (amount === null || amount <= 0 || usdt === null || usdt <= 0) continue

    const orderNumber = orderLine?.match(/\d{10,}/)?.[0] ?? null

    // Ultima linea de la tarjeta: apodo de la contraparte y fecha de creacion.
    const footer = block.find((line) => P2P_FOOTER_STAMP.test(line)) ?? ''
    const stamp = footer.match(P2P_FOOTER_STAMP)
    const counterparty = cleanCounterparty(footer.replace(P2P_FOOTER_STAMP, ''))

    let occurredOn: string | null = null
    if (stamp) {
      const month = Number(stamp[1])
      const day = Number(stamp[2])
      const year = resolveYear(month, day, today)
      occurredOn = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    const priceToken = priceLine ? numberAfter(priceLine) : null
    const flags: string[] = []
    if (!occurredOn) flags.push('Falta la fecha.')

    rows.push(
      makeRow({
        source: 'p2p_order',
        amount,
        currency: 'VEF',
        // Vender USDT: llegan Bs. Comprar USDT: salen Bs.
        direction,
        occurredOn,
        time: stamp ? to24h(stamp[3]!) : null,
        description: `Binance P2P${counterparty ? ` · ${counterparty}` : ''}`,
        reference: orderNumber,
        flags,
        // Cada orden se propone como la transferencia USDT <-> Bs que es, con los USDT ya
        // conocidos. Si despues se enlaza con un abono del banco (ver matchP2pOrders.ts), la
        // transferencia pasa a ese abono y esta fila se oculta para no contarla dos veces.
        action: 'transfer',
        sentAmount: usdt,
        p2p: { usdt, price: priceToken, orderNumber, counterparty },
      }),
    )
  }
  return rows
}
