import { LIST_AMOUNT_MIN_RIGHT_EDGE } from './dictionary/bankListFormats'
import { FEE_CATEGORY } from './dictionary/feeWords'
import { LIST_AMOUNT_PATTERN, LIST_CURRENCY, LIST_HAS_CURRENCY, LIST_TIME_PATTERN } from './dictionary/listPatterns'
import { isFeeText, matchesReceived, resolveDateHeader, suggestCategory } from './movementDictionary'
import { makeRow, to24h } from './movementRows'
import type { ScanRow } from './movementRows'
import { centerY } from './ocrLayout'
import type { OcrBox, Segment } from './ocrLayout'
import { parseLocalizedNumber } from './numbers'

// Los montos de una lista del banco y las horas son las anclas: cada monto es una fila, y
// su hora esta justo debajo. Los patrones estan en dictionary/listPatterns.ts.

export interface BankListOptions {
  // Para resolver "AYER" / "HOY" (se inyecta para poder probar sin depender del reloj).
  today: Date
  // Fecha a usar cuando la captura no trae encabezados de dia.
  defaultDate: string | null
  // Mide si el monto esta escrito en verde (recibido). Null = no se pudo medir.
  isGreen: (box: OcrBox) => boolean | null
  // Ancho de la imagen; sin el se usa el borde derecho del texto mas a la derecha.
  imageWidth?: number
  // false en formatos donde el color no distingue recibido de pagado (ver
  // dictionary/bankListFormats.ts): ahi la direccion sale solo del texto o de `fallbackDirection`.
  colorCodesDirection?: boolean
  // Direccion a usar cuando nada la indica (lo que el usuario dijo que va a registrar).
  // Sin valor, se asume gasto y la fila se marca para confirmar.
  fallbackDirection?: 'in' | 'out'
  // false = no tomar en cuenta las comisiones: se descartan en vez de unirse a su operacion.
  includeFees?: boolean
}

function isAmountSegment(segment: Segment, rightEdge: number): boolean {
  return (
    LIST_HAS_CURRENCY.test(segment.text) &&
    LIST_AMOUNT_PATTERN.test(segment.text.trim()) &&
    segment.x1 >= rightEdge * LIST_AMOUNT_MIN_RIGHT_EDGE
  )
}

function isTimeSegment(segment: Segment): boolean {
  return LIST_TIME_PATTERN.test(segment.text.trim())
}

// El OCR lee los iconos de la lista (las flechas de entrada y salida) como caracteres sueltos
// y a veces pierde media linea: ", q Operacion pagomovil bdv", "Cobro comision pag movil 4".
// Se quitan los caracteres sueltos del inicio y del final del texto (una palabra real tiene
// al menos dos caracteres).
function cleanDescription(raw: string): string {
  const tokens = raw.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  while (tokens.length > 1 && tokens[0]!.length <= 1) tokens.shift()
  while (tokens.length > 1 && tokens[tokens.length - 1]!.length <= 1) tokens.pop()
  // Un unico token suelto no dice nada.
  return tokens.length === 1 && tokens[0]!.length <= 1 ? '' : tokens.join(' ')
}

// Une la comision con la operacion que la origino. El banco las lista como dos movimientos
// separados con la misma hora ("Cobro comision pag movil" junto a "Operacion pagomovil"); para
// el usuario es una sola operacion con comision. Si el OCR no leyo la hora de alguna de las dos
// filas, se une con la fila siguiente: el banco lista la comision justo antes de su operacion.
export function mergeFees(rows: ScanRow[]): ScanRow[] {
  const result = [...rows]
  for (const feeRow of rows) {
    if (!isFeeText(feeRow.description) || feeRow.direction !== 'out') continue
    const feeIndex = result.indexOf(feeRow)

    let partner: ScanRow | null = null
    let bestDistance = Infinity
    result.forEach((candidate, index) => {
      if (candidate === feeRow || isFeeText(candidate.description)) return
      if (candidate.direction !== 'out') return
      if (candidate.occurredOn !== feeRow.occurredOn || candidate.time === null || candidate.time !== feeRow.time) return
      const distance = Math.abs(index - feeIndex)
      if (distance < bestDistance) {
        bestDistance = distance
        partner = candidate
      }
    })

    if (!partner) {
      const next = result[feeIndex + 1]
      const timeUnknown = feeRow.time === null || next?.time === null
      if (next && !isFeeText(next.description) && next.direction === 'out' && next.occurredOn === feeRow.occurredOn && timeUnknown) {
        partner = next
      }
    }

    if (partner) {
      const target: ScanRow = partner
      target.fee = Math.round((target.fee + feeRow.amount) * 100) / 100
      result.splice(feeIndex, 1)
    }
  }
  return result
}

export function parseBankList(segments: Segment[], options: BankListOptions): ScanRow[] {
  const ordered = [...segments].sort((a, b) => centerY(a) - centerY(b) || a.x0 - b.x0)

  // Segmentos por linea visual, para saber si un encabezado esta solo en su linea.
  const lineSizes = new Map<number, number>()
  for (const segment of ordered) lineSizes.set(segment.line, (lineSizes.get(segment.line) ?? 0) + 1)

  // Los montos de la lista van pegados al borde derecho; el saldo de la cabecera no.
  const rightEdge = options.imageWidth ?? Math.max(...ordered.map((segment) => segment.x1), 0)
  const amounts = ordered.filter((segment) => isAmountSegment(segment, rightEdge))
  const times = ordered.filter((segment) => isTimeSegment(segment))
  const used = new Set<Segment>([...amounts, ...times])

  const rows: ScanRow[] = []
  let currentDate = options.defaultDate

  for (const segment of ordered) {
    if (!used.has(segment) && lineSizes.get(segment.line) === 1) {
      const header = resolveDateHeader(segment.text, options.today)
      if (header) {
        currentDate = header
        used.add(segment)
        continue
      }
    }
    if (!amounts.includes(segment)) continue

    const amountHeight = segment.y1 - segment.y0
    const time = times.find(
      (candidate) =>
        centerY(candidate) > centerY(segment) &&
        centerY(candidate) - centerY(segment) < amountHeight * 3 &&
        Math.abs(candidate.x1 - segment.x1) < (segment.x1 - segment.x0) * 1.2,
    )

    const top = segment.y0 - amountHeight * 0.6
    const bottom = (time?.y1 ?? segment.y1) + amountHeight * 0.3
    const description = cleanDescription(
      ordered
        .filter(
          (candidate) =>
            !used.has(candidate) &&
            candidate.x1 <= segment.x0 &&
            centerY(candidate) >= top &&
            centerY(candidate) <= bottom,
        )
        .map((candidate) => candidate.text)
        .join(' '),
    )

    const amountToken = segment.text.match(/\d[\d.,]*/)?.[0]
    const amount = amountToken ? parseLocalizedNumber(amountToken, 'es') : null
    if (amount === null || amount <= 0) continue

    const colorCodes = options.colorCodesDirection ?? true
    const green = colorCodes ? options.isGreen(segment) : null
    const receivedByText = matchesReceived(description)

    let direction: 'in' | 'out'
    if (receivedByText || green === true) direction = 'in'
    else if (green === false) direction = 'out'
    else direction = options.fallbackDirection ?? 'out'

    const flags: string[] = []
    if (receivedByText && green === false) flags.push('El texto dice recibido, pero el monto no está en verde. Revisa.')
    if (!receivedByText && green === null && options.fallbackDirection === undefined) {
      flags.push(
        colorCodes
          ? 'Revisa si es un gasto o dinero recibido.'
          : 'Esta pantalla no distingue gastos de recibidos: confirma cuál es.',
      )
    }
    if (!currentDate) flags.push('Falta la fecha.')

    rows.push(
      makeRow({
        source: 'bank',
        amount,
        currency: LIST_CURRENCY,
        direction,
        occurredOn: currentDate,
        time: time ? to24h(time.text) : null,
        description,
        flags,
        category: direction === 'out' ? (suggestCategory(description) ?? '') : '',
      }),
    )
  }

  let merged = mergeFees(rows)
  if (options.includeFees === false) {
    // Sin comisiones: se descartan las filas de comision que no se unieron a nada y se
    // limpian las que si.
    merged = merged.filter((row) => !(isFeeText(row.description) && row.direction === 'out'))
    for (const row of merged) row.fee = 0
  }
  // Una comision sin operacion a la que unirse se registra como su propio gasto.
  for (const row of merged) {
    if (isFeeText(row.description) && row.direction === 'out' && row.category === '') row.category = FEE_CATEGORY
  }
  return merged
}
