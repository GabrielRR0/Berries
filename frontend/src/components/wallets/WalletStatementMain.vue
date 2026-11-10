<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWalletStatement } from '../../composables/wallets/useWalletStatement'
import type { Transaction } from '../../services/transactions/interfaces/transactions.interface'
import type { TransferEditTarget } from '../../services/wallets/interfaces/wallets.interface'
import { useTransactionsStore } from '../../stores/transactions.store'
import { useWalletsStore } from '../../stores/wallets.store'
import { buildStatementSummary, statementBalances, statementTransactions } from '../../utils/wallets/statementRows'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import TransactionForm from '../transactions/TransactionForm.vue'
import TransactionHistory from '../transactions/TransactionHistory.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import TransferForm from './TransferForm.vue'

// Cartola de UNA billetera (/cuentas/:id): sus movimientos del mas reciente al mas antiguo,
// cada uno con el saldo que quedo despues de aplicarse, para ver de donde sale el saldo de
// Cuentas y encontrar un descuadre. Las filas son las MISMAS de Movimientos
// (TransactionHistory.vue en modo billetera): se abren con todo el detalle y se editan
// (fecha y hora incluidas) o eliminan igual. Los saldos vienen de
// useWalletStatement.ts; los estilos propios en walletStatement.css.
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

const summary = computed(() => (statement.value ? buildStatementSummary(statement.value) : null))
const walletTransactions = computed(() => statementTransactions(statement.value, transactionsStore.transactions))
// Getters (no valores): el historial los vuelve a leer cuando cambian los saldos o movimientos.
const walletMode = {
  allTransactions: () => transactionsStore.transactions,
  balances: () => statementBalances(statement.value),
}
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
    <SectionHeader title="Cartola" max-width="40rem" @back="goBack" @help="showHelpSheet = true" />

    <div class="statement">
      <p v-if="error || actionError" class="statement-error" role="alert">{{ error ?? actionError }}</p>

      <Transition name="loading-fade" mode="out-in">
        <LoadingIndicator v-if="showLoading" key="loading" class="statement-loading" label="Cargando cartola..." />

        <div v-else-if="summary && statement" key="content" class="statement-content">
          <BaseCard class="statement-summary">
            <p class="statement-wallet">{{ statement.walletName }} · {{ statement.currency }}</p>
            <p class="statement-balance">{{ summary.currentBalance }}</p>
            <p class="statement-balance-label">Saldo actual · {{ summary.movementCount }} movimientos</p>
          </BaseCard>

          <p v-if="summary.isInconsistent" class="statement-warning" role="status">
            Tus movimientos suman más de lo que hay en la cuenta ({{ summary.openingBalance }} de saldo inicial).
            Revisa si falta un ingreso o si algún gasto está de más.
          </p>

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
        </div>
      </Transition>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es la cartola?" @close="showHelpSheet = false">
      <p class="statement-help">
        Es el historial de esta billetera: cada movimiento con el saldo que quedó después de aplicarlo. Toca uno para
        ver todo su detalle, editarlo (fecha y hora incluidas) o eliminarlo. El saldo inicial es lo que ya había antes
        del primer movimiento registrado.
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
