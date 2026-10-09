import { parseBankList } from './bankListParser'
import { parseBankStatement } from './bankStatementParser'
import { BANK_LIST_FORMATS, DEFAULT_COLOR_CODES_DIRECTION } from './dictionary/bankListFormats'
import { MIN_STATEMENT_DATES, STATEMENT_DATE_GLOBAL, STATEMENT_KIND_SIGNALS } from './dictionary/bankStatementLabels'
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

// Que clase de captura es, mirando el texto: un estado de cuenta en tabla, una lista de ordenes P2P,
// una lista de movimientos del banco, un solo movimiento o algo que no se reconoce.
export type ImageKind = 'bank_statement' | 'p2p_orders' | 'bank_list' | 'single' | 'unknown'

export function classifyImageKind(text: string, options: { allowStatement?: boolean } = {}): ImageKind {
  const normalized = normalizeForMatch(text)

  // Estado de cuenta en tabla: aparecen sus titulos (Fecha, Descripcion/Concepto, Monto/Importe/Debito...)
  // y varias fechas de fila (un comprobante suelto trae una sola). Ver dictionary/bankStatementLabels.ts.
  if (
    options.allowStatement !== false &&
    STATEMENT_KIND_SIGNALS.every((signal) => signal.test(normalized)) &&
    (normalized.match(STATEMENT_DATE_GLOBAL) ?? []).length >= MIN_STATEMENT_DATES
  ) {
    return 'bank_statement'
  }

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

// Lo que el usuario dice que va a registrar (lo elige antes de subir la captura, es opcional):
// todo, solo gastos, solo ingresos (recibidos) o transferencias entre sus cuentas (ver applyScanContext.ts).
export type ScanScope = 'all' | 'expenses' | 'received' | 'transfers'

export interface RowsFromImageOptions {
  today: Date
  // Fecha para las filas que no traen encabezado de dia (la que elige el usuario).
  defaultDate: string | null
  // Solo gastos, solo recibidos, transferencias o todo. Aqui solo se filtra por direccion en los movimientos
  // del banco; el resto del contexto (ordenes P2P, pendientes) lo aplica applyScanContext.
  scope?: ScanScope
  // false = ignorar las comisiones del banco.
  includeFees?: boolean
}

// Reconoce el formato de la lista por su titulo, para saber si el color distingue recibido de pagado.
function colorCodesDirection(text: string): boolean {
  const normalized = normalizeForMatch(text)
  const format = BANK_LIST_FORMATS.find(({ titlePattern }) => titlePattern.test(normalized))
  return format ? format.colorCodesDirection : DEFAULT_COLOR_CODES_DIRECTION
}

function keepScope(rows: ScanRow[], scope: ScanScope): ScanRow[] {
  // En 'transfers' no se filtra: tanto lo recibido como lo pagado puede ser parte de una transferencia.
  if (scope === 'all' || scope === 'transfers') return rows
  const wanted = scope === 'expenses' ? 'out' : 'in'
  return rows.filter((row) => row.source !== 'bank' || row.direction === wanted)
}

export interface RowsFromImage {
  kind: ImageKind
  rows: ScanRow[]
}

export function rowsFromImage(layout: LayoutInput, options: RowsFromImageOptions): RowsFromImage {
  let kind = classifyImageKind(layout.text)

  if (kind === 'bank_statement') {
    // El estado de cuenta dice explicitamente si cada movimiento es debito o credito: el filtro de
    // "solo gastos" / "solo ingresos" se aplica directamente.
    const rows = parseBankStatement(layout.words, {
      imageWidth: layout.width,
      defaultDate: options.defaultDate,
      includeFees: options.includeFees,
    })
    if (rows.length > 0) return { kind, rows: keepScope(rows, options.scope ?? 'all') }
    // Parecia una tabla pero no se pudieron ubicar sus columnas: se prueban los otros lectores.
    kind = classifyImageKind(layout.text, { allowStatement: false })
  }
  if (kind === 'p2p_orders') {
    return { kind, rows: parseP2pOrderList(groupSegments(layout.words, layout.width), options.today) }
  }
  if (kind === 'bank_list') {
    const scope = options.scope ?? 'all'
    const rows = parseBankList(groupSegments(layout.words, layout.width), {
      today: options.today,
      defaultDate: options.defaultDate,
      isGreen: layout.isGreen,
      imageWidth: layout.width,
      colorCodesDirection: colorCodesDirection(layout.text),
      // Si el usuario dijo que son solo gastos (o solo recibidos), eso desempata cuando la
      // pantalla no da ninguna senal de direccion.
      fallbackDirection: scope === 'received' ? 'in' : scope === 'expenses' ? 'out' : undefined,
      includeFees: options.includeFees,
    })
    return { kind, rows: keepScope(rows, scope) }
  }
  if (kind === 'single') {
    return { kind, rows: keepScope(rowsFromSingleScan(scanText(layout.text)), options.scope ?? 'all') }
  }
  return { kind, rows: [] }
}
