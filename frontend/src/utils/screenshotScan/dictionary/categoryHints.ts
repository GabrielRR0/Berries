// Categoria sugerida segun lo que dice el movimiento. Solo hay sugerencia donde el
// nombre es inequivoco; el usuario siempre puede cambiarla y nunca se crea una
// categoria nueva sin que lo confirme. Texto en minusculas y sin tildes.
import { FEE_CATEGORY } from './feeWords'

export interface CategoryHint {
  pattern: RegExp
  category: string
}

export const CATEGORY_HINTS: CategoryHint[] = [
  { pattern: /\bcomision\b|\bcommission\b|\bfee\b/, category: FEE_CATEGORY },
  { pattern: /\bgasolina\b|\bcombustible\b|\bfuel\b/, category: 'Gasolina' },
  { pattern: /\bsupermercado\b|\bmercado\b|\bgrocer/, category: 'Mercado' },
]
