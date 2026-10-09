import { parseBankList } from './bankListParser'
import {
  BOLIVAR_AMOUNT_GLOBAL,
  MIN_LIST_AMOUNTS,
  MIN_LIST_TIMES,
  MIN_ORDER_STARTS,
  ORDER_HISTORY_TITLE,
  ORDER_START_GLOBAL,
  TIME_OF_DAY_GLOBAL,
} from './dictionary/imageKindWords'
import { makeRow } from './movementRows'
import type { ScanRow } from './movementRows'
import { groupSegments } from './ocrLayout'
import type { OcrBox, OcrWord } from './ocrLayout'
import { parseP2pOrderList } from './p2pOrderListParser'
import { scanText } from './scanText'
import { normalizeForMatch } from './textLines'
import type { ScanResult } from './types'

// Que clase de captura es, mirando el texto: una lista de ordenes P2P, una lista
// de movimientos del banco, un solo movimiento o algo que no se reconoce.
export type ImageKind = 'p2p_orders' | 'bank_list' | 'single' | 'unknown'

export function classifyImageKind(text: string): ImageKind {
  const normalized = normalizeForMatch(text)

  const orderStarts = (normalized.match(ORDER_START_GLOBAL) ?? []).length
  if (orderStarts >= MIN_ORDER_STARTS || (orderStarts >= 1 && ORDER_HISTORY_TITLE.test(normalized))) {
    return 'p2p_orders'
  }

  const times = (normalized.match(TIME_OF_DAY_GLOBAL) ?? []).length
  const amounts = (normalized.match(BOLIVAR_AMOUNT_GLOBAL) ?? []).length
  if (times >= MIN_LIST_TIMES && amounts >= MIN_LIST_AMOUNTS) return 'bank_list'

  return scanText(text).kind === 'unknown' ? 'unknown' : 'single'
}

// Un movimiento suelto leido por los perfiles de captura individual -> una fila.
export function rowsFromSingleScan(scan: ScanResult): ScanRow[] {
  if (scan.kind === 'p2p_transfer') {
    if (scan.amount === null || scan.convertedAmount === null) return []
    if (scan.direction === 'buy') return []
    return [
      makeRow({
        source: 'p2p_order',
        amount: scan.convertedAmount,
        currency: scan.fiatCurrency,
        direction: 'in',
        occurredOn: scan.occurredOn,
        description: `Binance P2P${scan.counterparty ? ` · ${scan.counterparty}` : ''}`,
        reference: scan.orderNumber,
        // En una transferencia la comision es del lado que envia (USDT).
        fee: scan.fee ?? 0,
        flags: [...scan.warnings, ...(scan.occurredOn ? [] : ['Falta la fecha.'])],
        action: 'transfer',
        sentAmount: scan.amount,
        p2p: { usdt: scan.amount + (scan.fee ?? 0), price: scan.unitPrice, orderNumber: scan.orderNumber, counterparty: scan.counterparty },
      }),
    ]
  }

  if (scan.kind === 'bank_movement') {
    if (scan.amount === null) return []
    const direction = scan.direction === 'credit' ? 'in' : 'out'
    return [
      makeRow({
        source: 'bank',
        amount: scan.amount,
        currency: scan.currency,
        direction,
        occurredOn: scan.occurredOn,
        description: scan.description ?? '',
        reference: scan.reference,
        flags: [...scan.warnings, ...(scan.occurredOn ? [] : ['Falta la fecha.'])],
      }),
    ]
  }
  return []
}

export interface LayoutInput {
  text: string
  words: OcrWord[]
  width: number
  isGreen: (box: OcrBox) => boolean | null
}

export interface RowsFromImageOptions {
  today: Date
  // Fecha para las filas que no traen encabezado de dia (la que elige el usuario).
  defaultDate: string | null
}

export interface RowsFromImage {
  kind: ImageKind
  rows: ScanRow[]
}

export function rowsFromImage(layout: LayoutInput, options: RowsFromImageOptions): RowsFromImage {
  const kind = classifyImageKind(layout.text)

  if (kind === 'p2p_orders') {
    return { kind, rows: parseP2pOrderList(groupSegments(layout.words, layout.width), options.today) }
  }
  if (kind === 'bank_list') {
    const rows = parseBankList(groupSegments(layout.words, layout.width), {
      today: options.today,
      defaultDate: options.defaultDate,
      isGreen: layout.isGreen,
    })
    return { kind, rows }
  }
  if (kind === 'single') return { kind, rows: rowsFromSingleScan(scanText(layout.text)) }
  return { kind, rows: [] }
}
