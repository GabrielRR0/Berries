import type { Transaction } from '../../services/transactions/interfaces/transactions.interface'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { mergeTransferLegs } from '../transactions/transactionListItems'

// Estadisticas de transferencias y comisiones para Cuentas (todas las billeteras) y la
// cartola (una billetera). Funciones puras sobre los movimientos que ya estan en la cache
// del frontend: nada nuevo que pedir al backend. Una transferencia son 2 patas (salida y
// entrada) mas, si hubo comision, una tercera pata de gasto con category "Comisión" (ver
// execute_transfer en el backend); mergeTransferLegs las reune.
export type StatsPeriod = 'month' | '30d' | 'all'

export const STATS_PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
  { value: 'month', label: 'Este mes' },
  { value: '30d', label: '30 días' },
  { value: 'all', label: 'Todo' },
]

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function isInStatsPeriod(occurredAt: string, period: StatsPeriod, now: Date = new Date()): boolean {
  if (period === 'all') return true
  const time = new Date(occurredAt).getTime()
  if (period === '30d') return time >= now.getTime() - 30 * MS_PER_DAY
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return time >= start
}

// Texto de "desde cuando" para los subtitulos de las tarjetas.
export function statsPeriodCaption(period: StatsPeriod): string {
  if (period === 'month') return 'este mes'
  if (period === '30d') return 'en los últimos 30 días'
  return 'en total'
}

export interface TransferRouteStat {
  key: string
  fromWalletId: string
  toWalletId: string
  fromName: string
  toName: string
  count: number
  // Comision acumulada en la moneda de la billetera de origen (siempre la misma en una ruta).
  feeNative: number
  feeCurrency: string
  // Mismo monto en USD (valor congelado de cada comision); null si alguna no tiene valor en USD.
  feeUsd: number | null
  // Cuantas de esas transferencias llevaron comision.
  feeCount: number
}

export interface TransferStats {
  // Transferencias en las que participa la billetera (o todas, sin filtro por billetera).
  transferCount: number
  sentCount: number
  receivedCount: number
  // Comisiones pagadas (solo las de transferencias SALIDAS de la billetera, si se filtra por una).
  feeCount: number
  feeUsd: number
  // true si alguna comision no tiene valor en USD conocido: feeUsd es entonces un minimo.
  feeUsdIsPartial: boolean
  // Comision como % de lo movido, sobre las transferencias con valor en USD conocido; null si no hay base.
  feePercent: number | null
  routes: TransferRouteStat[]
}

function currencyOf(transaction: Transaction, wallets: Wallet[]): string {
  return transaction.currency ?? wallets.find((wallet) => wallet.id === transaction.walletId)?.currency ?? 'USD'
}

function usdValue(transaction: Transaction, wallets: Wallet[]): number | null {
  if (transaction.referenceAmountUsd !== null) return transaction.referenceAmountUsd
  return currencyOf(transaction, wallets) === 'USD' ? transaction.amount : null
}

export function computeTransferStats(
  transactions: Transaction[],
  wallets: Wallet[],
  period: StatsPeriod,
  options: { walletId?: string; now?: Date } = {},
): TransferStats {
  const { walletId, now = new Date() } = options
  const nameOf = (id: string) => wallets.find((wallet) => wallet.id === id)?.name ?? 'Billetera eliminada'

  let sentCount = 0
  let receivedCount = 0
  let transferCount = 0
  let feeCount = 0
  let feeUsd = 0
  let feeUsdIsPartial = false
  let volumeUsd = 0
  let volumeFeeUsd = 0
  // Una transferencia con comision cuyo monto no tiene valor en USD deja el % sin base fiable.
  let percentUnreliable = false
  const routes = new Map<string, TransferRouteStat>()

  for (const item of mergeTransferLegs(transactions)) {
    if (item.kind !== 'transfer') continue
    if (!isInStatsPeriod(item.occurredAt, period, now)) continue
    const sent = walletId === undefined || item.fromLeg.walletId === walletId
    const received = walletId === undefined || item.toLeg.walletId === walletId
    if (!sent && !received) continue

    transferCount++
    if (walletId !== undefined) {
      if (sent) sentCount++
      else receivedCount++
    }
    // Sin filtro, cada transferencia cuenta como "enviada" para el desglose por ruta.
    if (!sent) continue

    const fee = item.feeLeg
    const feeValueUsd = fee ? usdValue(fee, wallets) : 0
    if (fee) {
      feeCount++
      if (feeValueUsd === null) feeUsdIsPartial = true
      else feeUsd += feeValueUsd
    }
    const moved = usdValue(item.fromLeg, wallets)
    if (fee && (moved === null || feeValueUsd === null)) percentUnreliable = true
    if (moved !== null && feeValueUsd !== null) {
      volumeUsd += moved
      volumeFeeUsd += feeValueUsd
    }

    const key = `${item.fromLeg.walletId}>${item.toLeg.walletId}`
    const route = routes.get(key) ?? {
      key,
      fromWalletId: item.fromLeg.walletId,
      toWalletId: item.toLeg.walletId,
      fromName: nameOf(item.fromLeg.walletId),
      toName: nameOf(item.toLeg.walletId),
      count: 0,
      feeNative: 0,
      feeCurrency: currencyOf(item.fromLeg, wallets),
      feeUsd: 0 as number | null,
      feeCount: 0,
    }
    route.count++
    if (fee) {
      route.feeCount++
      route.feeNative += fee.amount
      route.feeUsd = route.feeUsd === null || feeValueUsd === null ? null : route.feeUsd + feeValueUsd
    }
    routes.set(key, route)
  }

  if (walletId !== undefined) {
    // En la cartola "enviadas" y "recibidas" son excluyentes por billetera: una transferencia
    // entre dos billeteras distintas nunca es ambas cosas para la misma.
    receivedCount = transferCount - sentCount
  }

  return {
    transferCount,
    sentCount,
    receivedCount,
    feeCount,
    feeUsd,
    feeUsdIsPartial,
    feePercent: volumeUsd > 0 && !percentUnreliable ? (volumeFeeUsd / volumeUsd) * 100 : null,
    routes: [...routes.values()].sort(
      (a, b) => (b.feeUsd ?? 0) - (a.feeUsd ?? 0) || b.feeNative - a.feeNative || b.count - a.count,
    ),
  }
}
