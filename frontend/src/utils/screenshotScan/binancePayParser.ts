import {
  PAY_AMOUNT,
  PAY_DETAIL_LABELS as LABELS,
  PAY_RECEIVED,
  PAY_SENT,
  PAY_STAMP,
} from './dictionary/binancePayLabels'
import { makeRow } from './movementRows'
import type { RowDirection, ScanRow } from './movementRows'
import { parseLocalizedNumber } from './numbers'
import { findValueAfterLabel, normalizeForMatch, toLines } from './textLines'
import type { BankMovementScan } from './types'

// Lee las capturas de Binance Pay (envios y recibos de USDT entre usuarios, que no son P2P).
// Las etiquetas estan en dictionary/binancePayLabels.ts. Cada movimiento es un gasto o un
// ingreso de la billetera USDT; el usuario puede cambiarlo a transferencia en la revision.

const LOCALE = 'es'

interface PayAmount {
  amount: number
  direction: RowDirection | null
}

function readAmount(normalizedLine: string): PayAmount | null {
  const match = normalizedLine.match(PAY_AMOUNT)
  if (!match) return null
  const amount = parseLocalizedNumber(match[2]!, LOCALE)
  if (amount === null || amount <= 0) return null
  const sign = match[1]
  return { amount, direction: sign === undefined ? null : sign === '+' ? 'in' : 'out' }
}

// Apodo sin el ruido que el OCR agrega al final ("eliasj@gmail.com |", "--").
function cleanName(raw: string | null | undefined): string | null {
  const cleaned = (raw ?? '').replace(/[|>›»\[\]]+/g, ' ').replace(/\s+/g, ' ').trim()
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : null
}

function describe(counterparty: string | null, note: string | null): string {
  return ['Binance Pay', counterparty, note].filter(Boolean).join(' · ')
}

// Lista "Activos > Pay". Un movimiento empieza en su linea de monto; si la captura corta el
// ultimo antes de su fecha se descarta (aparecera completo en la siguiente captura).
// `fallbackDirection`: lo que dijo el usuario (solo gastos / solo recibidos), por si no hay signo ni tipo.
export function parseBinancePayList(text: string, fallbackDirection?: RowDirection): ScanRow[] {
  const lines = toLines(text)
  const rows: ScanRow[] = []
  let current: { amount: PayAmount; kindDirection: RowDirection | null; counterparty: string | null } | null = null

  const flush = (stampLine: string) => {
    const stamp = stampLine.match(PAY_STAMP)
    if (!current || !stamp) return
    // El signo manda; si el OCR lo perdio, se usa el tipo ("Enviar criptos" = salio).
    const direction = current.amount.direction ?? current.kindDirection ?? fallbackDirection ?? null
    const flags = direction === null ? ['No se supo si entró o salió: revisa el tipo.'] : []
    rows.push(
      makeRow({
        source: 'bank',
        amount: current.amount.amount,
        currency: 'USDT',
        direction: direction ?? 'out',
        occurredOn: stamp[1]!,
        time: stamp[2]!,
        stamp: `${stamp[1]} ${stamp[2]}:${stamp[3]}`,
        description: describe(current.counterparty, null),
        flags,
      }),
    )
    current = null
  }

  for (const line of lines) {
    const normalized = normalizeForMatch(line)
    const amount = readAmount(normalized)
    if (amount) {
      current = { amount, kindDirection: null, counterparty: null }
      continue
    }
    if (!current) continue
    if (PAY_SENT.test(normalized) || PAY_RECEIVED.test(normalized)) {
      current.kindDirection = PAY_SENT.test(normalized) ? 'out' : 'in'
      const kind = normalized.match(PAY_SENT) ?? normalized.match(PAY_RECEIVED)
      current.counterparty = cleanName(line.slice(kind![0].length))
      continue
    }
    if (PAY_STAMP.test(line)) flush(line)
  }
  return rows
}

// "Detalles del pago" de un solo movimiento.
export function extractBinancePay(text: string): BankMovementScan {
  const lines = toLines(text)
  const normalizedLines = lines.map(normalizeForMatch)

  let headline: PayAmount | null = null
  for (const line of normalizedLines) {
    headline = readAmount(line)
    if (headline) break
  }

  // "De" = me lo enviaron; "A" = lo envie (y debajo del correo va el apodo).
  const fromIndex = normalizedLines.findIndex((line) => LABELS.from.test(line))
  const toIndex = normalizedLines.findIndex((line) => LABELS.to.test(line))
  let counterparty: string | null = null
  if (fromIndex !== -1) counterparty = cleanName(lines[fromIndex]!.replace(/^\S+\s+/, ''))
  else if (toIndex !== -1) {
    const value = cleanName(lines[toIndex]!.replace(/^\S+\s+/, ''))
    const nickname = lines[toIndex + 1]
    const nicknameIsBare = nickname !== undefined && /^[\p{L}\p{N}_.\-]+$/u.test(nickname.trim())
    // Se prefiere el apodo al correo: es lo que muestra la lista y no expone datos personales.
    counterparty = value?.includes('@') && nicknameIsBare ? nickname!.trim() : value
  }
  const labelDirection: RowDirection | null = fromIndex !== -1 ? 'in' : toIndex !== -1 ? 'out' : null
  const direction = headline?.direction ?? labelDirection

  const stamp = (findValueAfterLabel(lines, LABELS.time) ?? '').match(PAY_STAMP)
  const orderId = findValueAfterLabel(lines, LABELS.orderId)?.match(/\d{8,}/)?.[0] ?? null
  const note = cleanName(findValueAfterLabel(lines, LABELS.note))

  return {
    kind: 'bank_movement',
    bank: 'binance',
    direction: direction === 'in' ? 'credit' : direction === 'out' ? 'debit' : null,
    amount: headline?.amount ?? null,
    currency: 'USDT',
    occurredOn: stamp ? stamp[1]! : null,
    time: stamp ? stamp[2]! : null,
    stamp: stamp ? `${stamp[1]} ${stamp[2]}:${stamp[3]}` : null,
    reference: orderId,
    description: describe(counterparty, note),
    warnings: direction === null ? ['No se supo si entró o salió: revisa el tipo.'] : [],
  }
}
