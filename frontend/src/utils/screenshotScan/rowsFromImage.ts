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
import { parseBinancePayList } from './binancePayParser'
import { MIN_PAY_LIST_ITEMS, PAY_LIST_ITEM_GLOBAL } from './dictionary/binancePayLabels'
import { makeRow } from './movementRows'
import type { ScanRow } from './movementRows'
import { groupSegments } from './ocrLayout'
import type { OcrBox, OcrWord } from './ocrLayout'
import { parseP2pOrderList } from './p2pOrderListParser'
import { scanText } from './scanText'
import { normalizeForMatch } from './textLines'
import type { ScanResult } from './types'

const MISSING_DATE_FLAG = 'Falta la fecha.'

// Que clase de captura es, mirando el texto: un estado de cuenta en tabla, una lista de ordenes P2P,
// una lista de movimientos del banco, la lista de Binance Pay, un solo movimiento o algo que no se reconoce.
export type ImageKind = 'bank_statement' | 'p2p_orders' | 'bank_list' | 'binance_pay' | 'single' | 'unknown'

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

  // Lista "Activos > Pay" de Binance: varios "Pay -40 USDT". Ver dictionary/binancePayLabels.ts.
  if ((normalized.match(PAY_LIST_ITEM_GLOBAL) ?? []).length >= MIN_PAY_LIST_ITEMS) return 'binance_pay'

  const times = (normalized.match(TIME_OF_DAY_GLOBAL) ?? []).length
  const amounts = (normalized.match(BOLIVAR_AMOUNT_GLOBAL) ?? []).length
  if (times >= MIN_LIST_TIMES && amounts >= MIN_LIST_AMOUNTS) return 'bank_list'

  return scanText(text).kind === 'unknown' ? 'unknown' : 'single'
}

// Un movimiento suelto leido por los perfiles de captura individual -> una fila.
export function rowsFromSingleScan(scan: ScanResult): ScanRow[] {
  if (scan.kind === 'p2p_transfer') {
    if (scan.amount === null || scan.convertedAmount === null) return []
    // Vender USDT: salen USDT (con su comision) y llega la moneda local.
    // Comprar USDT (ej. con dolares de Zinli o Wally): sale la moneda local y llegan los USDT
    // recibidos, que ya vienen sin la comision.
    const isBuy = scan.direction === 'buy'
    const fee = isBuy ? 0 : (scan.fee ?? 0)
    const flags = [...scan.warnings, ...(scan.occurredOn ? [] : [MISSING_DATE_FLAG])]
    if (!scan.fiatCurrency) flags.push('No se reconoció la moneda del importe.')
    return [
      makeRow({
        source: 'p2p_order',
        amount: scan.convertedAmount,
        currency: scan.fiatCurrency,
        direction: isBuy ? 'out' : 'in',
        occurredOn: scan.occurredOn,
        description: ['Binance P2P', scan.counterparty, scan.paymentMethod].filter(Boolean).join(' · '),
        reference: scan.orderNumber,
        // En una transferencia la comision es del lado que envia (USDT al vender).
        fee,
        flags,
        action: 'transfer',
        sentAmount: scan.amount,
        p2p: {
          usdt: scan.amount + fee,
          price: scan.unitPrice,
          orderNumber: scan.orderNumber,
          counterparty: scan.counterparty,
          paymentMethod: scan.paymentMethod,
        },
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
        time: scan.time ?? null,
        stamp: scan.stamp ?? null,
        flags: [...scan.warnings, ...(scan.occurredOn ? [] : [MISSING_DATE_FLAG])],
      }),
    ]
  }
  return []
}

// Algunas pantallas no muestran la fecha (el detalle de una orden P2P la esconde en la parte
// plegada): se usa la que el usuario eligio al subir, avisando para que la revise.
function withDefaultDate(rows: ScanRow[], defaultDate: string | null): ScanRow[] {
  if (!defaultDate) return rows
  for (const row of rows) {
    if (row.occurredOn) continue
    row.occurredOn = defaultDate
    row.flags = [...row.flags.filter((flag) => flag !== MISSING_DATE_FLAG), 'La captura no muestra la fecha: se usó la elegida al subir.']
  }
  return rows
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
  // Cuantas filas se leyeron de la imagen ANTES de aplicar "solo gastos" / "solo ingresos": con 0 no se
  // pudo leer nada (la captura no se entendio); con mas de 0 y ninguna en `rows`, el filtro las dejo fuera.
  readCount: number
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
    if (rows.length > 0) return { kind, rows: keepScope(rows, options.scope ?? 'all'), readCount: rows.length }
    // Parecia una tabla pero no se pudieron ubicar sus columnas: se prueban los otros lectores.
    kind = classifyImageKind(layout.text, { allowStatement: false })
  }
  if (kind === 'p2p_orders') {
    const rows = parseP2pOrderList(groupSegments(layout.words, layout.width), options.today)
    return { kind, rows, readCount: rows.length }
  }
  if (kind === 'binance_pay') {
    // El signo del monto dice si entro o salio; si el OCR lo perdio, desempata lo que eligio el usuario.
    const scope = options.scope ?? 'all'
    const rows = parseBinancePayList(layout.text, scope === 'received' ? 'in' : scope === 'expenses' ? 'out' : undefined)
    return { kind, rows: keepScope(rows, scope), readCount: rows.length }
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
    return { kind, rows: keepScope(rows, scope), readCount: rows.length }
  }
  if (kind === 'single') {
    const rows = withDefaultDate(rowsFromSingleScan(scanText(layout.text)), options.defaultDate)
    return { kind, rows: keepScope(rows, options.scope ?? 'all'), readCount: rows.length }
  }
  return { kind, rows: [], readCount: 0 }
}
