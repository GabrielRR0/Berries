import { STATEMENT_DATE, STATEMENT_TIME } from '../dictionary/bankStatementLabels'
import { suggestCategory } from '../movementDictionary'
import { makeRow, to24h } from '../movementRows'
import { centerY } from '../ocrLayout'
import type { OcrWord } from '../ocrLayout'
import { parseLocalizedNumber } from '../numbers'
import { normalizeForMatch } from '../textLines'
import { cellText, columnOf } from './columnLayout'
import type { StatementProfile } from './profiles/types'
import type { Columns, Entry, ReadAmount, RowBounds, RowCells, StatementColumn, StatementMode } from './types'

// Leer UNA fila de la tabla: primero el texto de cada celda (readCells), despues el movimiento (readEntry).

// El texto de cada celda de la fila: las palabras que caen entre los limites de la fila, por columna.
export function readCells(body: OcrWord[], columns: Columns, tolerance: number, bounds: RowBounds): RowCells {
  const byColumn = new Map<StatementColumn, OcrWord[]>()
  for (const word of body) {
    const y = centerY(word)
    if (y <= bounds.top || y > bounds.bottom) continue
    const column = columnOf(word, columns, tolerance)
    if (column) byColumn.set(column, [...(byColumn.get(column) ?? []), word])
  }
  const text = (column: StatementColumn): string => cellText(byColumn.get(column) ?? [])
  return {
    date: text('date'),
    reference: text('reference'),
    description: text('description'),
    amount: text('amount'),
    balance: text('balance'),
    debit: text('debit'),
    credit: text('credit'),
  }
}

// Un numero de una celda ("-25.000,00"): su valor sin signo y si traia el menos. null si no hay numero.
// Si la celda trae pedazos sueltos que el OCR invento ("-14, 20.000,00"), se prefiere el numero completo.
export function readAmount(text: string, profile: StatementProfile): ReadAmount | null {
  const tokens = text.match(/-?\s*\d[\d.,]*/g) ?? []
  const token = tokens.find((candidate) => profile.amountShape.test(candidate.replace(/\s+/g, ''))) ?? tokens[0]
  if (!token) return null
  const value = parseLocalizedNumber(token, profile.numberLocale)
  return value === null ? null : { value, negative: token.trim().startsWith('-') }
}

// El monto y el sentido de la fila segun la variante de la tabla. Agrega a `flags` los avisos que haga falta.
interface AmountAndDirection {
  amount: ReadAmount | null
  direction: 'in' | 'out'
}

function readAmountAndDirection(cells: RowCells, mode: StatementMode, profile: StatementProfile, flags: string[]): AmountAndDirection {
  if (mode === 'split') {
    const out = readAmount(cells.debit, profile)
    const into = readAmount(cells.credit, profile)
    return { amount: out ?? into, direction: out ? 'out' : 'in' }
  }
  const amount = readAmount(cells.amount, profile)
  const signed: 'in' | 'out' = amount?.negative ? 'out' : 'in'
  if (mode !== 'typed') return { amount, direction: signed }

  const type = normalizeForMatch(cells.debit)
  if (profile.creditWord.test(type)) return { amount, direction: 'in' }
  if (profile.debitWord.test(type)) return { amount, direction: 'out' }
  // Un monto con "-" es un debito sin dudas; sin signo (un credito, o un "-" que el OCR perdio) se avisa.
  if (!amount?.negative) flags.push('No se leyó si fue débito o crédito: se dedujo del signo del monto. Revisa.')
  return { amount, direction: signed }
}

// El movimiento de una fila, o null si no es un movimiento (sin monto, o un resto de fila cortada por el borde).
export function readEntry(cells: RowCells, mode: StatementMode, profile: StatementProfile, defaultDate: string | null): Entry | null {
  const flags: string[] = []

  const dateMatch = cells.date.match(STATEMENT_DATE)
  const occurredOn = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : defaultDate
  if (!dateMatch) flags.push(occurredOn ? 'No se leyó la fecha: se usó la elegida al inicio.' : 'Falta la fecha.')
  const time = cells.date.replace(STATEMENT_DATE, '').match(STATEMENT_TIME)?.[1]

  const { amount, direction } = readAmountAndDirection(cells, mode, profile, flags)
  if (!amount || amount.value <= 0) return null
  // Un resto de la fila que el recorte de la captura dejo cortada: sin fecha NI referencia no es un movimiento.
  const reference = cells.reference.match(profile.referenceInCell)?.[0] ?? null
  if (!dateMatch && !reference) return null

  const balance = readAmount(cells.balance, profile)
  const row = makeRow({
    source: 'bank',
    amount: amount.value,
    currency: profile.currency,
    direction,
    occurredOn,
    time: time ? to24h(time) : null,
    description: cells.description,
    reference,
    flags,
    category: direction === 'out' ? (suggestCategory(cells.description) ?? '') : '',
  })
  return {
    row,
    signedAmount: direction === 'in' ? amount.value : -amount.value,
    balance: balance ? (balance.negative ? -balance.value : balance.value) : null,
  }
}
