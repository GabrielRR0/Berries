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
}

function isAmountSegment(segment: Segment): boolean {
  return LIST_HAS_CURRENCY.test(segment.text) && LIST_AMOUNT_PATTERN.test(segment.text.trim())
}

function isTimeSegment(segment: Segment): boolean {
  return LIST_TIME_PATTERN.test(segment.text.trim())
}

// Une la comision con la operacion que la origino. El banco las lista como dos
// movimientos separados con la misma hora ("Cobro comision pag movil" junto a
// "Operacion pagomovil"); para el usuario es una sola operacion con comision.
function mergeFees(rows: ScanRow[]): ScanRow[] {
  const result = [...rows]
  for (const feeRow of rows) {
    if (!isFeeText(feeRow.description) || feeRow.direction !== 'out') continue

    let partnerIndex = -1
    let bestDistance = Infinity
    result.forEach((candidate, index) => {
      if (candidate === feeRow || isFeeText(candidate.description)) return
      if (candidate.direction !== 'out') return
      if (candidate.occurredOn !== feeRow.occurredOn || candidate.time === null || candidate.time !== feeRow.time) return
      const distance = Math.abs(index - result.indexOf(feeRow))
      if (distance < bestDistance) {
        bestDistance = distance
        partnerIndex = index
      }
    })

    if (partnerIndex !== -1) {
      const partner = result[partnerIndex]!
      partner.fee = Math.round((partner.fee + feeRow.amount) * 100) / 100
      result.splice(result.indexOf(feeRow), 1)
    }
  }
  return result
}

export function parseBankList(segments: Segment[], options: BankListOptions): ScanRow[] {
  const ordered = [...segments].sort((a, b) => centerY(a) - centerY(b) || a.x0 - b.x0)

  // Segmentos por linea visual, para saber si un encabezado esta solo en su linea.
  const lineSizes = new Map<number, number>()
  for (const segment of ordered) lineSizes.set(segment.line, (lineSizes.get(segment.line) ?? 0) + 1)

  const amounts = ordered.filter(isAmountSegment)
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
    if (!isAmountSegment(segment)) continue

    const amountHeight = segment.y1 - segment.y0
    const time = times.find(
      (candidate) =>
        centerY(candidate) > centerY(segment) &&
        centerY(candidate) - centerY(segment) < amountHeight * 3 &&
        Math.abs(candidate.x1 - segment.x1) < (segment.x1 - segment.x0) * 1.2,
    )

    const top = segment.y0 - amountHeight * 0.6
    const bottom = (time?.y1 ?? segment.y1) + amountHeight * 0.3
    const description = ordered
      .filter(
        (candidate) =>
          !used.has(candidate) &&
          candidate.x1 <= segment.x0 &&
          centerY(candidate) >= top &&
          centerY(candidate) <= bottom,
      )
      .map((candidate) => candidate.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const amountToken = segment.text.match(/\d[\d.,]*/)?.[0]
    const amount = amountToken ? parseLocalizedNumber(amountToken, 'es') : null
    if (amount === null || amount <= 0) continue

    const green = options.isGreen(segment)
    const receivedByText = matchesReceived(description)
    const direction = receivedByText || green === true ? 'in' : 'out'

    const flags: string[] = []
    if (receivedByText && green === false) flags.push('El texto dice recibido, pero el monto no está en verde. Revisa.')
    if (green === null && !receivedByText) flags.push('Revisa si es un gasto o dinero recibido.')
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

  const merged = mergeFees(rows)
  // Una comision sin operacion a la que unirse se registra como su propio gasto.
  for (const row of merged) {
    if (isFeeText(row.description) && row.direction === 'out' && row.category === '') row.category = FEE_CATEGORY
  }
  return merged
}
