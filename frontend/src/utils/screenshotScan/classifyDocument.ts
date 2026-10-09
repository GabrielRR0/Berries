import { DOCUMENT_SIGNALS, MIN_DOCUMENT_SCORE } from './dictionary/documentSignals'
import type { DocumentType } from './dictionary/documentSignals'
import { normalizeForMatch } from './textLines'

export type { DocumentType } from './dictionary/documentSignals'

// Decide que tipo de captura de UN movimiento es: cada tipo suma puntos por las
// palabras que lo identifican (ver dictionary/documentSignals.ts) y gana el de mayor
// puntaje si llega al minimo; con menos queda "unknown" y la pantalla avisa que no
// reconocio el documento en vez de adivinar.
export function classifyDocument(text: string): DocumentType {
  const normalized = normalizeForMatch(text)
  let best: DocumentType = 'unknown'
  let bestScore = MIN_DOCUMENT_SCORE - 1

  for (const { type, signals } of DOCUMENT_SIGNALS) {
    const score = signals.reduce((total, { pattern, points }) => total + (pattern.test(normalized) ? points : 0), 0)
    if (score > bestScore) {
      best = type
      bestScore = score
    }
  }
  return best
}
