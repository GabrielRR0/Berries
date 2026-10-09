import {
  BDV_PAGO_MOVIL_LABELS,
  CREDIT_PATTERN,
  DEBIT_PATTERN,
  FACEBANK_LABELS,
  HEADLINE_BOLIVAR_AMOUNT,
  HEADLINE_DOLLAR_AMOUNT,
} from './dictionary/bankLabels'
import type { BankLabels } from './dictionary/bankLabels'
import { parseDateToIso, parseLocalizedNumber } from './numbers'
import { findValueAfterLabel, normalizeForMatch, toLines } from './textLines'
import type { BankMovementScan, BankName } from './types'

// Lee el comprobante de UN movimiento de un banco. Las etiquetas de cada banco
// estan en dictionary/bankLabels.ts; agregar otro banco es una entrada de datos
// mas una funcion de abajo que llama a extractBankMovement con sus etiquetas.

// Los comprobantes de estos bancos estan en espanol de Venezuela: dia/mes/ano
// y numeros como "22.848,00" o "100.00".
const LOCALE = 'es'

// El monto no tiene etiqueta: es el numero grande de la cabecera ("$ 100.00",
// "22.848,00 Bs"), asi que se busca la linea que es solo monto + simbolo.
function findHeadlineAmount(lines: string[]): { amount: number; currency: string } | null {
  for (const line of lines) {
    const dollars = line.match(HEADLINE_DOLLAR_AMOUNT)
    if (dollars) {
      const amount = parseLocalizedNumber(dollars[1]!, LOCALE)
      if (amount !== null) return { amount, currency: 'USD' }
    }
    const bolivars = line.match(HEADLINE_BOLIVAR_AMOUNT)
    if (bolivars) {
      const amount = parseLocalizedNumber(bolivars[1]!, LOCALE)
      if (amount !== null) return { amount, currency: 'VEF' }
    }
  }
  return null
}

function extractBankMovement(text: string, bank: BankName, labels: BankLabels): BankMovementScan {
  const lines = toLines(text)
  const headline = findHeadlineAmount(lines)

  const dateRaw = findValueAfterLabel(lines, labels.date)
  const referenceRaw = findValueAfterLabel(lines, labels.reference)

  let description: string | null = null
  for (const label of labels.description) {
    description = findValueAfterLabel(lines, label)?.trim() || null
    if (description) break
  }

  let direction: BankMovementScan['direction'] = null
  if (labels.direction) {
    const typeRaw = normalizeForMatch(findValueAfterLabel(lines, labels.direction) ?? '')
    direction = DEBIT_PATTERN.test(typeRaw) ? 'debit' : CREDIT_PATTERN.test(typeRaw) ? 'credit' : null
  }

  return {
    kind: 'bank_movement',
    bank,
    direction,
    amount: headline?.amount ?? null,
    currency: headline?.currency ?? null,
    occurredOn: dateRaw ? parseDateToIso(dateRaw, LOCALE) : null,
    reference: referenceRaw?.match(/\d{4,}/)?.[0] ?? null,
    description,
    warnings: [],
  }
}

// "Comprobante de operacion" de Pago Movil BDV: siempre es un pago saliente.
export function extractBdvPagoMovil(text: string): BankMovementScan {
  return { ...extractBankMovement(text, 'bdv', BDV_PAGO_MOVIL_LABELS), direction: 'debit' }
}

// "Detalle de movimiento" de Facebank: el tipo (Debito/Credito) viene en el detalle.
export function extractFacebankMovement(text: string): BankMovementScan {
  return extractBankMovement(text, 'facebank', FACEBANK_LABELS)
}
