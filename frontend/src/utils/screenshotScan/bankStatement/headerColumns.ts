import { STATEMENT_COLUMNS, STATEMENT_COLUMN_SYNONYMS } from '../dictionary/bankStatementLabels'
import type { StatementColumn, StatementMode } from '../dictionary/bankStatementLabels'
import { centerY } from '../ocrLayout'
import type { OcrWord } from '../ocrLayout'
import { normalizeForMatch } from '../textLines'
import type { ColumnStarts, Columns } from './types'

// Ubica las columnas de la tabla por sus TITULOS (Fecha, Referencia, Monto...), que se reconocen por sinonimos.
// Recibe las palabras del OCR y devuelve las columnas, o null si los titulos no alcanzan para leer la tabla.

// Una palabra que parece el titulo de una columna.
interface HeaderHit {
  word: OcrWord
  column: StatementColumn
}

function headerHits(words: OcrWord[]): HeaderHit[] {
  const hits: HeaderHit[] = []
  for (const word of words) {
    const text = normalizeForMatch(word.text)
    for (const column of STATEMENT_COLUMNS) {
      if (STATEMENT_COLUMN_SYNONYMS[column].some((pattern) => pattern.test(text))) hits.push({ word, column })
    }
  }
  return hits
}

// Agrupa los titulos por linea y devuelve la linea que junta mas columnas distintas.
function bestHeaderRow(hits: HeaderHit[], lineHeight: number): HeaderHit[] {
  const rows: HeaderHit[][] = []
  for (const hit of [...hits].sort((a, b) => centerY(a.word) - centerY(b.word))) {
    const row = rows.find((group) => Math.abs(centerY(group[0]!.word) - centerY(hit.word)) <= lineHeight * 0.8)
    if (row) row.push(hit)
    else rows.push([hit])
  }
  const distinct = (row: HeaderHit[]): number => new Set(row.map((hit) => hit.column)).size
  return rows.reduce((current, candidate) => (distinct(candidate) > distinct(current) ? candidate : current))
}

// "Debito / Credito" en una columna: el titulo trae una barra entre las dos palabras.
function hasSlashBetween(words: OcrWord[], debit: OcrWord, credit: OcrWord, lineHeight: number): boolean {
  return words.some(
    (word) =>
      word.text.trim() === '/' &&
      centerY(word) >= centerY(debit) - lineHeight &&
      centerY(word) <= centerY(debit) + lineHeight &&
      word.x0 >= debit.x0 &&
      word.x1 <= credit.x1,
  )
}

// La fila de titulos es la que junta mas columnas distintas (un "Fecha desde" de un filtro, arriba de la
// tabla, no se confunde con ella). Devuelve null si no hay una combinacion legible.
export function findColumnsFromHeaders(words: OcrWord[]): Columns | null {
  const hits = headerHits(words)
  if (hits.length === 0) return null

  const lineHeight = Math.max(...words.map((word) => word.y1 - word.y0), 1)
  const headerRow = bestHeaderRow(hits, lineHeight)

  // Por columna se queda la palabra mas a la izquierda de la fila de titulos.
  const found = new Map<StatementColumn, OcrWord>()
  for (const { word, column } of headerRow) {
    const current = found.get(column)
    if (!current || word.x0 < current.x0) found.set(column, word)
  }
  if (!found.has('date') || !found.has('description')) return null

  const debit = found.get('debit')
  const credit = found.get('credit')
  const hasAmount = found.has('amount')
  const typed = debit !== undefined && credit !== undefined && hasSlashBetween(words, debit, credit, lineHeight)

  const starts: ColumnStarts = {}
  for (const [column, word] of found) starts[column] = word.x0

  let mode: StatementMode
  if (typed) {
    // "Debito / Credito" con barra es UNA sola columna de tipo (no dos de monto): sin la columna del
    // monto no hay nada que leer. La de tipo empieza donde empieza "Debito".
    if (!hasAmount) return null
    mode = 'typed'
    delete starts.credit
  } else if (debit !== undefined && credit !== undefined) {
    mode = 'split'
    delete starts.amount
  } else if (hasAmount) {
    mode = 'signed'
    delete starts.debit
    delete starts.credit
  } else {
    return null
  }

  return { mode, starts, headerBottom: Math.max(...headerRow.map((hit) => hit.word.y1)) }
}
