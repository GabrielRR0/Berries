// Logica para entender un movimiento por lo que dice su texto. Las palabras y patrones
// NO viven aqui: estan en ./dictionary/*.ts (un archivo por tema) para poder
// editarlos o ampliarlos sin tocar este codigo.
import { CATEGORY_HINTS } from './dictionary/categoryHints'
import { MONTHS_ES, RELATIVE_DAY_PATTERNS, WEEKDAYS_ES } from './dictionary/dateWords'
import { PAID_PATTERNS, RECEIVED_PATTERNS } from './dictionary/directionWords'
import { FEE_PATTERNS } from './dictionary/feeWords'
import { WALLET_HINTS } from './dictionary/walletHints'
import type { WalletKey } from './dictionary/walletHints'
import { parseDateToIso } from './numbers'
import { normalizeForMatch } from './textLines'

export type { WalletKey } from './dictionary/walletHints'

function matchesAny(patterns: RegExp[], text: string): boolean {
  const normalized = normalizeForMatch(text)
  return patterns.some((pattern) => pattern.test(normalized))
}

export function matchesReceived(text: string): boolean {
  return matchesAny(RECEIVED_PATTERNS, text)
}

export function matchesPaid(text: string): boolean {
  return matchesAny(PAID_PATTERNS, text)
}

export function isFeeText(text: string): boolean {
  return matchesAny(FEE_PATTERNS, text)
}

export function suggestCategory(text: string): string | null {
  const normalized = normalizeForMatch(text)
  return CATEGORY_HINTS.find(({ pattern }) => pattern.test(normalized))?.category ?? null
}

// Palabras con las que el usuario suele nombrar la billetera de ese banco.
export function walletNameHints(key: WalletKey): string[] {
  return WALLET_HINTS[key].nameHints
}

// Banco o plataforma que menciona el texto, si se reconoce.
export function detectWalletKey(text: string): WalletKey | null {
  const normalized = normalizeForMatch(text)
  const keys = Object.keys(WALLET_HINTS) as WalletKey[]
  return keys.find((key) => WALLET_HINTS[key].textPattern.test(normalized)) ?? null
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function daysBefore(base: Date, days: number): Date {
  const shifted = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  shifted.setDate(shifted.getDate() - days)
  return shifted
}

// Encabezado de seccion de una lista ("AYER", "Hoy", "08/10/2026", "8 de octubre")
// a YYYY-MM-DD. `today` se inyecta para poder probarlo sin depender del reloj.
export function resolveDateHeader(text: string, today: Date): string | null {
  const normalized = normalizeForMatch(text).trim()
  if (normalized === '') return null

  const relative = RELATIVE_DAY_PATTERNS.find(({ pattern }) => pattern.test(normalized))
  if (relative) return toIso(daysBefore(today, relative.daysAgo))

  const numeric = parseDateToIso(normalized, 'es')
  if (numeric) return numeric

  // "7 de octubre", "miercoles, 7 de octubre", "7 de octubre de 2026".
  const withoutWeekday = normalized.replace(new RegExp(`^(${WEEKDAYS_ES.join('|')}),?\\s+`), '')
  const written = withoutWeekday.match(/^(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?$/)
  if (written) {
    const month = MONTHS_ES.indexOf(written[2]!)
    if (month === -1) return null
    const day = Number(written[1])
    let year = written[3] ? Number(written[3]) : today.getFullYear()
    // Sin ano, una fecha que caeria en el futuro es del ano anterior (ej. "28 de diciembre" visto en enero).
    if (!written[3] && new Date(year, month, day) > today) year -= 1
    const date = new Date(year, month, day)
    return date.getMonth() === month ? toIso(date) : null
  }
  return null
}
