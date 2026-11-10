<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWalletStatement } from '../../composables/wallets/useWalletStatement'
import type { Transaction } from '../../services/transactions/interfaces/transactions.interface'
import type { TransferEditTarget } from '../../services/wallets/interfaces/wallets.interface'
import { useTransactionsStore } from '../../stores/transactions.store'
import { useWalletsStore } from '../../stores/wallets.store'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { buildFlowTiles } from '../../utils/wallets/overviewTiles'
import { buildStatementSummary, statementBalances, statementTransactions } from '../../utils/wallets/statementRows'
import { computeTransferStats, STATS_PERIOD_OPTIONS, statsPeriodCaption } from '../../utils/wallets/transferStats'
import type { StatsPeriod } from '../../utils/wallets/transferStats'
import { computeWalletFlow } from '../../utils/wallets/walletFlow'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import TransactionForm from '../transactions/TransactionForm.vue'
import TransactionHistory from '../transactions/TransactionHistory.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import PillToggle from '../ui/PillToggle.vue'
import StatTiles from '../ui/StatTiles.vue'
import RouteFeesCard from './RouteFeesCard.vue'
import TransferForm from './TransferForm.vue'

// Cartola de UNA billetera (/cuentas/:id): sus movimientos del mas reciente al mas antiguo,
// cada uno con el saldo que quedo despues de aplicarse, para ver de donde sale el saldo de
// Cuentas y encontrar un descuadre. Las filas son las MISMAS de Movimientos
// (TransactionHistory.vue en modo billetera): se abren con todo el detalle y se editan
// (fecha y hora incluidas) o eliminan igual. Encima, estadisticas de la billetera
// (ingresos, gastos, transferencias, comisiones) y cuanto se paga de comision por destino.
// Saldos: useWalletStatement.ts; estadisticas: utils/wallets/; estilos: walletStatement.css.
const route = useRoute()
const router = useRouter()
const walletsStore = useWalletsStore()
const transactionsStore = useTransactionsStore()
const walletId = computed(() => String(route.params.id))
const { statement, isLoading, error, reload } = useWalletStatement(walletId)

const showHelpSheet = ref(false)
const editingTransaction = ref<Transaction | null>(null)
const editingTransfer = ref<TransferEditTarget | null>(null)
const actionError = ref<string | null>(null)
const period = ref<StatsPeriod>('month')

const summary = computed(() => (statement.value ? buildStatementSummary(statement.value) : null))
const walletTransactions = computed(() => statementTransactions(statement.value, transactionsStore.transactions))
// Getters (no valores): el historial los vuelve a leer cuando cambian los saldos o movimientos.
const walletMode = {
  allTransactions: () => transactionsStore.transactions,
  balances: () => statementBalances(statement.value),
}

const flow = computed(() => (statement.value ? computeWalletFlow(statement.value.entries, period.value) : null))
const transferStats = computed(() =>
  computeTransferStats(transactionsStore.transactions, walletsStore.wallets, period.value, { walletId: walletId.value }),
)
const tiles = computed(() =>
  statement.value && flow.value ? buildFlowTiles(flow.value, transferStats.value, statement.value.currency) : [],
)
// "Neto este mes: +12.00 USDT" - lo que de verdad cambio el saldo en el periodo.
const netCaption = computed(() => {
  if (!statement.value || !flow.value) return ''
  const sign = flow.value.net < 0 ? '-' : '+'
  return `Neto ${statsPeriodCaption(period.value)}: ${sign}${formatCurrency(Math.abs(flow.value.net), statement.value.currency)}`
})

const showLoading = computed(
  () => (isLoading.value && !statement.value) || (transactionsStore.isLoading && transactionsStore.transactions.length === 0),
)

onMounted(() => {
  walletsStore.fetchWallets().catch(() => {
    // Error ya reflejado en walletsStore.error.
  })
  transactionsStore.fetchTransactions().catch(() => {
    // Error ya reflejado en transactionsStore.error.
  })
})

function goBack() {
  router.push({ name: 'cuentas' })
}

function onEditTransaction(transaction: Transaction) {
  editingTransaction.value = transaction
}

function closeEditTransaction() {
  editingTransaction.value = null
}

function onTransactionUpdated(transaction: Transaction) {
  transactionsStore.recordUpdated(transaction)
  closeEditTransaction()
  reload()
}

function onEditTransfer(target: TransferEditTarget) {
  editingTransfer.value = target
}

function closeEditTransfer() {
  editingTransfer.value = null
}

// walletsStore.updateTransfer ya refresco wallets y movimientos: solo falta la cartola.
function onTransferUpdated() {
  closeEditTransfer()
  reload()
}

async function onDeleteTransaction(transactionId: string) {
  actionError.value = null
  try {
    await transactionsStore.removeTransaction(transactionId)
    await reload()
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'No se pudo eliminar el movimiento.'
  }
}
</script>

<template>
  <PageShell hide-tab-bar>
    <SectionHeader title="Cartola" max-width="72rem" @back="goBack" @help="showHelpSheet = true" />

    <div class="statement">
      <p v-if="error || actionError" class="statement-error" role="alert">{{ error ?? actionError }}</p>

      <Transition name="loading-fade" mode="out-in">
        <LoadingIndicator v-if="showLoading" key="loading" class="statement-loading" label="Cargando cartola..." />

        <div v-else-if="summary && statement" key="content" class="statement-content">
          <BaseCard class="statement-summary">
            <p class="statement-wallet">{{ statement.walletName }} · {{ statement.currency }}</p>
            <p class="statement-balance">{{ summary.currentBalance }}</p>
            <p class="statement-balance-label">Saldo actual · {{ summary.movementCount }} movimientos</p>
            <p class="statement-net">{{ netCaption }}</p>
          </BaseCard>

          <p v-if="summary.isInconsistent" class="statement-warning" role="status">
            Tus movimientos suman más de lo que hay en la cuenta ({{ summary.openingBalance }} de saldo inicial).
            Revisa si falta un ingreso o si algún gasto está de más.
          </p>

          <section class="statement-stats" aria-label="Resumen de la billetera">
            <div class="statement-stats-head">
              <h2 class="statement-section-title">Resumen</h2>
              <PillToggle v-model="period" :options="STATS_PERIOD_OPTIONS" />
            </div>
            <StatTiles :tiles="tiles" />
          </section>

          <div class="statement-layout">
            <section class="statement-primary" aria-label="Movimientos">
              <h2 class="statement-section-title">Movimientos</h2>

              <p v-if="walletTransactions.length === 0" class="statement-empty">
                Esta billetera todavía no tiene movimientos.
              </p>
              <TransactionHistory
                v-else
                :transactions="walletTransactions"
                :wallets="walletsStore.wallets"
                :wallet-mode="walletMode"
                @delete="onDeleteTransaction"
                @edit="onEditTransaction"
                @edit-transfer="onEditTransfer"
              />

              <div v-if="walletTransactions.length > 0" class="statement-opening">
                <span>Saldo inicial</span>
                <span class="statement-opening-value">{{ summary.openingBalance }}</span>
              </div>
            </section>

            <aside class="statement-aside">
              <RouteFeesCard :routes="transferStats.routes" :period="period" mode="native" />
            </aside>
          </div>
        </div>
      </Transition>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es la cartola?" @close="showHelpSheet = false">
      <p class="statement-help">
        Es el historial de esta billetera: cada movimiento con el saldo que quedó después de aplicarlo. Toca uno para
        ver todo su detalle, editarlo (fecha y hora incluidas) o eliminarlo. El saldo inicial es lo que ya había antes
        del primer movimiento registrado. El resumen separa lo que ingresó y gastaste de lo que solo moviste entre
        billeteras, y te dice cuánto pagaste en comisiones y hacia dónde.
      </p>
    </BottomSheet>

    <BottomSheet v-if="editingTransaction" title="Editar movimiento" @close="closeEditTransaction">
      <TransactionForm
        :editing-transaction="editingTransaction"
        @updated="onTransactionUpdated"
        @cancel="closeEditTransaction"
      />
    </BottomSheet>

    <BottomSheet v-if="editingTransfer" title="Editar transferencia" @close="closeEditTransfer">
      <TransferForm :editing-transfer="editingTransfer" @updated="onTransferUpdated" @cancel="closeEditTransfer" />
    </BottomSheet>
  </PageShell>
</template>

<style scoped src="./walletStatement.css"></style>
