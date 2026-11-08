import { mergeFees } from '../bankListParser'
import { FEE_CATEGORY } from '../dictionary/feeWords'
import { isFeeText } from '../movementDictionary'
import type { ScanRow } from '../movementRows'
import { centerY, dropGhostWords } from '../ocrLayout'
import type { OcrWord } from '../ocrLayout'
import { checkBalanceChain } from './balanceCheck'
import { findColumns } from './columnLayout'
import { pairFeesByReference } from './feePairing'
import { getProfile } from './profiles'
import { findAnchors, rowBounds } from './rowAnchors'
import { readCells, readEntry } from './rowReader'
import type { BankStatementOptions, Entry } from './types'

// Lee un estado de cuenta en TABLA. A diferencia de las capturas del celular, las columnas van muy juntas y el
// texto de una celda se pega con el de la vecina, asi que no se puede separar por huecos: se ubican las
// columnas (por titulos o por la forma de los datos), cada palabra se asigna a la columna donde empieza y cada
// fila a su ancla. Lo que depende del banco sale de su perfil (ver profiles/).
// Recibe las palabras del OCR y devuelve los movimientos; vacio si no se reconoce una tabla.

// Une las comisiones con su operacion. Primero por referencia (no depende del texto leido) y despues por
// descripcion, para lo que quede. Con includeFees en false las comisiones se descartan.
function mergeFeeRows(rows: ScanRow[], suffixDigits: number, includeFees: boolean): ScanRow[] {
  let merged = mergeFees(pairFeesByReference(rows, suffixDigits))
  if (!includeFees) {
    merged = merged.filter((row) => !(isFeeText(row.description) && row.direction === 'out'))
    for (const row of merged) row.fee = 0
  }
  // Una comision sin operacion a la que unirse se registra como su propio gasto.
  for (const row of merged) {
    if (isFeeText(row.description) && row.direction === 'out' && row.category === '') row.category = FEE_CATEGORY
  }
  return merged
}

export function parseBankStatement(rawWords: OcrWord[], options: BankStatementOptions): ScanRow[] {
  const profile = getProfile(options.bank)
  const words = dropGhostWords(rawWords)
  const columns = findColumns(words, profile)
  if (!columns) return []

  const tolerance = options.imageWidth * 0.012
  const body = words.filter((word) => centerY(word) > columns.headerBottom)
  const anchors = findAnchors(body, columns, tolerance, profile)
  if (anchors.length === 0) return []

  const entries: Entry[] = []
  for (const bounds of rowBounds(anchors, columns.headerBottom)) {
    const cells = readCells(body, columns, tolerance, bounds)
    const entry = readEntry(cells, columns.mode, profile, options.defaultDate)
    if (entry) entries.push(entry)
  }

  checkBalanceChain(entries)
  return mergeFeeRows(
    entries.map((entry) => entry.row),
    profile.feeReferenceSuffixDigits,
    options.includeFees !== false,
  )
}
