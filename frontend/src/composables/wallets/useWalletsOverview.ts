import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTransactionsStore } from '../../stores/transactions.store'
import { useWalletsStore } from '../../stores/wallets.store'
import { buildOverviewTiles } from '../../utils/wallets/overviewTiles'
import { computeTransferStats, isInStatsPeriod } from '../../utils/wallets/transferStats'
import type { StatsPeriod } from '../../utils/wallets/transferStats'
import { useWalletsPortfolio } from '../dashboard/useWalletsPortfolio'

// Estado de las estadisticas de Cuentas (WalletsMain.vue): patrimonio total en USD con el peso
// de cada billetera, estadisticas de transferencias/comisiones del periodo elegido y cuantos
// movimientos tiene cada billetera. Todo sale de lo que ya esta en la cache de los stores.
export function useWalletsOverview() {
  const walletsStore = useWalletsStore()
  const transactionsStore = useTransactionsStore()
  const { wallets } = storeToRefs(walletsStore)
  const { transactions } = storeToRefs(transactionsStore)

  const period = ref<StatsPeriod>('month')
  const { total, shares } = useWalletsPortfolio(wallets, ref('USD'))

  const stats = computed(() => computeTransferStats(transactions.value, wallets.value, period.value))

  // Movimientos reales del periodo: sin las patas ni las comisiones de transferencias.
  const periodMovementCount = computed(
    () =>
      transactions.value.filter((t) => t.transferId === null && isInStatsPeriod(t.occurredAt, period.value)).length,
  )

  const tiles = computed(() => buildOverviewTiles(stats.value, periodMovementCount.value, period.value))

  // Todos los movimientos de cada billetera (incluye transferencias), sin importar el periodo.
  const movementCountByWallet = computed(() => {
    const counts = new Map<string, number>()
    for (const t of transactions.value) counts.set(t.walletId, (counts.get(t.walletId) ?? 0) + 1)
    return counts
  })

  return { wallets, period, total, shares, stats, tiles, movementCountByWallet }
}
