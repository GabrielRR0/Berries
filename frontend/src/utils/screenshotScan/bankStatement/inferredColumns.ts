import { STATEMENT_DATE } from '../dictionary/bankStatementLabels'
import type { OcrWord } from '../ocrLayout'
import { normalizeForMatch } from '../textLines'
import type { StatementProfile } from './profiles/types'
import type { ColumnStarts, Columns } from './types'

// Ubica las columnas cuando la captura perdio la fila de titulos (se hizo scroll en la pagina). Si las filas
// traen fecha, la palabra Debito / Credito y montos, las columnas se deducen de DONDE caen esos datos: cada
// tipo de dato vive siempre en su columna. Solo para la tabla con tipo (BDV en linea), donde el dato de
// cada columna se reconoce por su forma (ver el perfil del banco). Devuelve null si hay muy pocas filas.
const MIN_INFERRED_ROWS = 2

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

// Separa los inicios de las cifras en dos grupos (monto y saldo) por el mayor hueco entre ellos.
// Devuelve [inicios del monto, inicios del saldo], o null si no hay dos grupos claros.
function splitAmountAndBalance(starts: number[], lineHeight: number): number[][] | null {
  const sorted = [...starts].sort((a, b) => a - b)
  const gaps = sorted.slice(1).map((x, index) => x - sorted[index]!)
  const biggest = Math.max(...gaps)
  if (gaps.length === 0 || biggest < lineHeight) return null
  const cut = gaps.indexOf(biggest) + 1
  return [sorted.slice(0, cut), sorted.slice(cut)]
}

export function inferColumnsFromRows(words: OcrWord[], profile: StatementProfile): Columns | null {
  const dates = words.filter((word) => STATEMENT_DATE.test(word.text))
  const types = words.filter((word) => profile.typeWord.test(normalizeForMatch(word.text)))
  const references = words.filter((word) => profile.referenceShape.test(word.text))
  if (dates.length < MIN_INFERRED_ROWS || types.length < MIN_INFERRED_ROWS) return null

  const typeStart = median(types.map((word) => word.x0))
  const amounts = words.filter((word) => profile.amountShape.test(word.text) && word.x0 > typeStart)
  if (amounts.length < MIN_INFERRED_ROWS) return null

  const lineHeight = Math.max(median(words.map((word) => word.y1 - word.y0)), 1)
  const groups = splitAmountAndBalance(amounts.map((word) => word.x0), lineHeight)
  if (!groups || groups[0]!.length === 0 || groups[1]!.length === 0) return null

  const dateStart = Math.min(...dates.map((word) => word.x0))
  const starts: ColumnStarts = {
    date: dateStart,
    debit: typeStart,
    amount: Math.min(...groups[0]!),
    balance: Math.min(...groups[1]!),
  }
  if (references.length > 0) {
    starts.reference = median(references.map((word) => word.x0))
    // La descripcion empieza donde termina la referencia.
    starts.description = Math.max(...references.map((word) => word.x1)) + 1
  } else {
    starts.description = (dateStart + typeStart) / 2
  }
  // Sin titulos todo lo que hay es cuerpo de la tabla.
  return { mode: 'typed', starts, headerBottom: -1 }
}
