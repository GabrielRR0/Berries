import { BINANCE_LABELS as LABELS, BINANCE_SELL_VERBS, SPANISH_LANGUAGE_PATTERN } from './dictionary/binanceLabels'
import { CANCELLED_PATTERN, COMPLETED_PATTERN } from './dictionary/statusWords'
import { parseDateToIso, parseLocalizedNumber } from './numbers'
import { findValueAfterLabel, normalizeForMatch, toLines } from './textLines'
import type { NumberLocale, P2PTransferScan } from './types'

// Lee la pantalla "Detalles de la orden" de Binance P2P. Las etiquetas (espanol e
// ingles) estan en dictionary/binanceLabels.ts.

// Del simbolo de la moneda local que muestra la app al codigo que usa Berry.
function fiatCurrencyFor(raw: string): string | null {
  return /\b(bs|ves|vef)\b/i.test(raw.replace(/(\d)/, ' $1')) ? 'VEF' : null
}

function detectLocale(normalizedText: string): NumberLocale {
  return SPANISH_LANGUAGE_PATTERN.test(normalizedText) ? 'es' : 'en'
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function extractBinanceP2p(text: string): P2PTransferScan {
  const lines = toLines(text)
  const normalizedText = normalizeForMatch(text)
  const locale = detectLocale(normalizedText)
  const warnings: string[] = []

  function numberFor(label: RegExp): number | null {
    const raw = findValueAfterLabel(lines, label)
    const token = raw?.match(/\d[\d.,]*/)?.[0]
    return token ? parseLocalizedNumber(token, locale) : null
  }

  const directionMatch = normalizedText.match(/\b(vender|comprar|sell|buy)\s+usdt\b/)
  const direction = directionMatch ? (BINANCE_SELL_VERBS.includes(directionMatch[1]!) ? 'sell' : 'buy') : null

  const fiatRaw = findValueAfterLabel(lines, LABELS.fiatAmount)
  const convertedAmount = numberFor(LABELS.fiatAmount)
  const unitPrice = numberFor(LABELS.unitPrice)
  const total = numberFor(LABELS.totalQuantity)
  const released = numberFor(LABELS.releasedQuantity)
  const fee = numberFor(LABELS.fee)

  // Sin detalle solo se ve el total; con detalle, el total ya incluye la
  // comision (total = liberada + comision), asi que el monto a transferir es lo
  // liberado y la comision va aparte: el egreso total coincide con el total.
  let amount: number | null = null
  if (released !== null) amount = released
  else if (total !== null) amount = fee !== null ? round2(total - fee) : total

  const timeRaw = findValueAfterLabel(lines, LABELS.createdAt)
  const occurredOn = timeRaw ? parseDateToIso(timeRaw, locale) : null

  const orderRaw = findValueAfterLabel(lines, LABELS.orderNumber)
  const orderNumber = orderRaw?.match(/\d{8,}/)?.[0] ?? null

  const counterparty =
    findValueAfterLabel(lines, LABELS.counterparty)
      ?.replace(/^(comprador|vendedor)\s+/i, '')
      .replace(/[^\p{L}\p{N}]+$/u, '')
      .trim() || null

  const completed = COMPLETED_PATTERN.test(normalizedText) ? true : CANCELLED_PATTERN.test(normalizedText) ? false : null

  if (completed === false) warnings.push('La orden no figura como completada.')
  if (total !== null && unitPrice !== null && convertedAmount !== null) {
    const expected = total * unitPrice
    if (Math.abs(expected - convertedAmount) / convertedAmount > 0.02) {
      warnings.push('El importe en Bs no coincide con la cantidad por el precio. Revisa los montos.')
    }
  }

  return {
    kind: 'p2p_transfer',
    direction,
    amount,
    fee,
    convertedAmount,
    fiatCurrency: fiatRaw ? fiatCurrencyFor(fiatRaw) : null,
    unitPrice,
    occurredOn,
    orderNumber,
    counterparty,
    completed,
    warnings,
  }
}
