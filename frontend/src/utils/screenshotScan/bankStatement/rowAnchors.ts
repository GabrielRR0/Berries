import { STATEMENT_DATE } from '../dictionary/bankStatementLabels'
import { centerY } from '../ocrLayout'
import type { OcrWord } from '../ocrLayout'
import { normalizeForMatch } from '../textLines'
import { wordsInColumns } from './columnLayout'
import type { StatementProfile } from './profiles/types'
import type { Columns, RowBounds, StatementColumn } from './types'

// Ubicar las filas: cada fila abre con una ANCLA (un dato que aparece una sola vez por fila) y los limites
// de una fila son los puntos medios entre anclas. Recibe las palabras del cuerpo y devuelve las anclas.

const HAS_DIGIT = /\d/

// Un monto que el OCR parte en dos palabras ("5" y ".000,00") no son dos filas: se quedan solo las anclas
// que no caen en la misma linea que la anterior.
export function dedupeAnchors(words: OcrWord[]): OcrWord[] {
  const sorted = [...words].sort((a, b) => centerY(a) - centerY(b))
  const kept: OcrWord[] = []
  for (const word of sorted) {
    const last = kept[kept.length - 1]
    const height = Math.max(word.y1 - word.y0, 1)
    if (last && Math.abs(centerY(word) - centerY(last)) <= height) continue
    kept.push(word)
  }
  return kept
}

// La ancla preferida es el dato que casi nunca se lee mal: la palabra de tipo (Debito/Credito), o el monto
// en las demas variantes; si no hay ninguna, la fecha. Asi una fecha ilegible no mezcla dos filas.
export function findAnchors(body: OcrWord[], columns: Columns, tolerance: number, profile: StatementProfile): OcrWord[] {
  const inColumns = (wanted: StatementColumn[]): OcrWord[] => wordsInColumns(body, columns, tolerance, wanted)
  let anchors: OcrWord[]
  if (columns.mode === 'typed') {
    // El OCR a veces lee mal la palabra de tipo ("DEBITO" -> "pero") y esa fila se fundiria con la vecina:
    // el monto tambien sale una vez por fila, asi que se usa el que ubique mas filas.
    const byType = dedupeAnchors(inColumns(['debit']).filter((word) => profile.typeWordStart.test(normalizeForMatch(word.text))))
    const byAmount = dedupeAnchors(inColumns(['amount']).filter((word) => HAS_DIGIT.test(word.text)))
    anchors = byAmount.length > byType.length ? byAmount : byType
  } else if (columns.mode === 'split') {
    anchors = dedupeAnchors(inColumns(['debit', 'credit']).filter((word) => HAS_DIGIT.test(word.text)))
  } else {
    anchors = dedupeAnchors(inColumns(['amount']).filter((word) => HAS_DIGIT.test(word.text)))
  }
  if (anchors.length === 0) anchors = inColumns(['date']).filter((word) => STATEMENT_DATE.test(word.text))
  return [...anchors].sort((a, b) => centerY(a) - centerY(b))
}

// Los limites verticales de cada fila: del punto medio con la ancla anterior al punto medio con la siguiente.
export function rowBounds(anchors: OcrWord[], headerBottom: number): RowBounds[] {
  return anchors.map((anchor, index) => ({
    top: index === 0 ? headerBottom : (centerY(anchors[index - 1]!) + centerY(anchor)) / 2,
    bottom: index === anchors.length - 1 ? Infinity : (centerY(anchor) + centerY(anchors[index + 1]!)) / 2,
  }))
}
