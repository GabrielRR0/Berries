<script setup lang="ts">
import { vPress } from '../../animation/vPress'
import { useCollapseTransition } from '../../animation/useCollapseTransition'
import { useListStaggerTransition } from '../../animation/useListStaggerTransition'
import { useTransactionHistory } from '../../composables/transactions/useTransactionHistory'
import type { Transaction } from '../../services/transactions/interfaces/transactions.interface'
import type { TransferEditTarget, Wallet } from '../../services/wallets/interfaces/wallets.interface'

// Historial de Movimientos agrupado por dia (rediseño): cada fila se expande
// al tocarla (detalle + Editar/Eliminar) en vez de mostrar las acciones
// siempre. Toda la logica (fusion de transferencias, neto por dia, estado de
// fila abierta) vive en composables/transactions/useTransactionHistory.ts;
// los estilos en transactionHistory.css. Inicio sigue usando TransactionList.vue.
const props = withDefaults(defineProps<{ transactions: Transaction[]; wallets: Wallet[]; fallbackCurrency?: string }>(), {
  fallbackCurrency: 'USD',
})
const emit = defineEmits<{
  delete: [transactionId: string]
  edit: [transaction: Transaction]
  editTransfer: [target: TransferEditTarget]
}>()

const { groups, expandedId, confirmingDeleteId, toggleRow, requestDelete, cancelDelete } = useTransactionHistory(
  () => props.transactions,
  () => props.wallets,
  () => props.fallbackCurrency,
)

// Entrada escalonada de filas y apertura del detalle: animaciones de Motion (src/animation/).
const rowTransition = useListStaggerTransition()
const detailTransition = useCollapseTransition()

function confirmDelete(deleteId: string) {
  cancelDelete()
  emit('delete', deleteId)
}
</script>

<template>
  <div class="history">
    <section v-for="group in groups" :key="group.key" class="history-day">
      <div class="history-day-heading">
        <h3 class="history-day-label">{{ group.label }}</h3>
        <span v-if="group.net" class="history-day-net">Neto {{ group.net }}</span>
      </div>

      <TransitionGroup
        tag="ul"
        name="history-row"
        class="history-card"
        :css="false"
        appear
        @before-enter="rowTransition.onBeforeEnter"
        @enter="rowTransition.onEnter"
        @leave="rowTransition.onLeave"
      >
        <li
          v-for="row in group.rows"
          :key="row.id"
          class="history-row"
          :class="{ 'is-open': expandedId === row.id }"
          :data-order="row.order"
        >
          <button
            v-press="0.985"
            type="button"
            class="history-row-main"
            :aria-expanded="expandedId === row.id"
            @click="toggleRow(row.id)"
          >
            <span class="history-tile" :class="row.kind">
              <svg v-if="row.kind === 'income'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="row.kind === 'expense'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path d="M12 5v14M6 13l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path d="M7 7h11m0 0-3.5-3.5M18 7l-3.5 3.5M17 17H6m0 0 3.5-3.5M6 17l3.5 3.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>

            <span class="history-info">
              <span class="history-title">{{ row.title }}</span>
              <span class="history-subtitle">{{ row.subtitle }}</span>
            </span>

            <span class="history-amounts">
              <span class="history-amount" :class="row.amountTone">{{ row.amount }}</span>
              <span v-if="row.secondary" class="history-secondary">{{ row.secondary }}</span>
            </span>
          </button>

          <Transition :css="false" @enter="detailTransition.onEnter" @leave="detailTransition.onLeave">
            <div v-if="expandedId === row.id" class="history-detail-wrap">
              <div class="history-detail">
            <dl class="history-detail-list">
              <div v-for="detail in row.details" :key="detail.label" class="history-detail-item">
                <dt>{{ detail.label }}</dt>
                <dd>{{ detail.value }}</dd>
              </div>
            </dl>

            <div v-if="confirmingDeleteId === row.id" class="history-actions history-confirm" role="alert">
              <span class="history-confirm-text">
                {{ row.isTransferDelete ? '¿Eliminar transferencia?' : '¿Eliminar movimiento?' }}
              </span>
              <button type="button" class="history-action" @click="cancelDelete">Cancelar</button>
              <button type="button" class="history-action danger solid" @click="confirmDelete(row.deleteId)">
                Confirmar
              </button>
            </div>
            <div v-else class="history-actions">
              <button
                v-if="row.edit"
                type="button"
                class="history-action"
                @click="row.edit.kind === 'transfer' ? emit('editTransfer', row.edit.target) : emit('edit', row.edit.transaction)"
              >
                Editar
              </button>
              <button type="button" class="history-action danger" @click="requestDelete(row.id)">Eliminar</button>
            </div>
              </div>
            </div>
          </Transition>
        </li>
      </TransitionGroup>
    </section>
  </div>
</template>

<style scoped src="./transactionHistory.css"></style>
