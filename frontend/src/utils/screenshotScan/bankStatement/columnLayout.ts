import { STATEMENT_COLUMNS } from '../dictionary/bankStatementLabels'
import { centerY } from '../ocrLayout'
import type { OcrRegion, OcrWord } from '../ocrLayout'
import { findColumnsFromHeaders } from './headerColumns'
import { inferColumnsFromRows } from './inferredColumns'
import { getProfile } from './profiles'
import type { BankId, StatementProfile } from './profiles'
import type { ColumnStart, ColumnStarts, Columns, StatementColumn } from './types'

// Ubicar la tabla en la imagen: que columnas hay, donde empieza cada una y a cual pertenece cada palabra.

// Primero por los titulos; si la captura los perdio, por la forma de los datos. null si no hay tabla legible.
export function findColumns(words: OcrWord[], profile: StatementProfile): Columns | null {
  return findColumnsFromHeaders(words) ?? inferColumnsFromRows(words, profile)
}

// Las columnas encontradas, cada una con su inicio.
export function listStarts(starts: ColumnStarts): ColumnStart[] {
  const list: ColumnStart[] = []
  for (const column of STATEMENT_COLUMNS) {
    const start = starts[column]
    if (start !== undefined) list.push({ column, start })
  }
  return list
}

// La columna de una palabra: la cuyo inicio esta mas cerca (por la izquierda). null si cae antes de todas.
export function columnOf(word: OcrWord, columns: Columns, tolerance: number): StatementColumn | null {
  let found: StatementColumn | null = null
  let foundStart = -Infinity
  for (const { column, start } of listStarts(columns.starts)) {
    if (word.x0 >= start - tolerance && start > foundStart) {
      found = column
      foundStart = start
    }
  }
  return found
}

// Las palabras del cuerpo que caen en alguna de esas columnas.
export function wordsInColumns(body: OcrWord[], columns: Columns, tolerance: number, wanted: StatementColumn[]): OcrWord[] {
  return body.filter((word) => {
    const column = columnOf(word, columns, tolerance)
    return column !== null && wanted.includes(column)
  })
}

// Une las palabras de una celda: por lineas (de arriba a abajo) y de izquierda a derecha dentro de cada una.
export function cellText(words: OcrWord[]): string {
  if (words.length === 0) return ''
  const ordered = [...words].sort((a, b) => centerY(a) - centerY(b) || a.x0 - b.x0)
  const lineHeight = Math.max(...ordered.map((word) => word.y1 - word.y0), 1)
  const lines: OcrWord[][] = []
  for (const word of ordered) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(centerY(word) - centerY(last[0]!)) <= lineHeight * 0.6) last.push(word)
    else lines.push([word])
  }
  return lines
    .map((line) => [...line].sort((a, b) => a.x0 - b.x0).map((word) => word.text).join(' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Region (en coordenadas de la imagen) de la columna de descripcion de una tabla ya reconocida. Tesseract
// lee mal las celdas de varias lineas cuando va con el resto de la pagina ("Eo BDV", "OM DON FAG"); si se
// relee esta columna sola, como un bloque, el texto sale casi perfecto. Null si no hay tabla o columna.
// Tesseract falla (error de memoria de WASM) con una region con decimales o que se sale de la imagen:
// por eso las medidas son enteros y se recortan a los limites.
export function statementDescriptionRegion(words: OcrWord[], imageWidth: number, imageHeight: number, bank?: BankId): OcrRegion | null {
  const columns = findColumns(words, getProfile(bank))
  const start = columns?.starts.description
  if (!columns || start === undefined) return null

  const margin = imageWidth * 0.004
  const nextStart = Math.min(...listStarts(columns.starts).map((item) => item.start).filter((other) => other > start))
  const left = Math.max(0, Math.floor(start - margin))
  const right = Math.min(imageWidth, Math.ceil(Number.isFinite(nextStart) ? nextStart - margin : start + imageWidth * 0.15))
  const top = Math.max(0, Math.floor(columns.headerBottom + 2))
  const bottom = Math.min(imageHeight, Math.ceil(Math.max(...words.map((word) => word.y1)) + 10))
  if (right <= left || bottom <= top) return null
  return { left, top, width: right - left, height: bottom - top }
}
