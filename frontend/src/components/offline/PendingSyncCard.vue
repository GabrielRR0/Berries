<script setup lang="ts">
import { computed } from 'vue'
import type { PendingOperation } from '../../stores/offlineQueue.store'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'

const props = defineProps<{ item: PendingOperation }>()
const emit = defineEmits<{ retry: [id: string]; discard: [id: string] }>()

// Resume de una linea por tipo, usando SOLO item.snapshot (nunca red) - la
// tarjeta se tiene que poder dibujar aunque siga sin señal.
const summary = computed(() => {
  const item = props.item
  if (item.kind === 'transaction') {
    const label = item.snapshot.type === 'income' ? 'Ingreso' : 'Gasto'
    return `${label} de ${formatCurrency(item.snapshot.amount, item.snapshot.walletCurrency)} en ${item.snapshot.walletName} (${item.snapshot.category})`
  }
  if (item.kind === 'transfer') {
    return `Transferencia de ${formatCurrency(item.snapshot.amount, item.snapshot.fromCurrency)} de ${item.snapshot.fromWalletName} a ${item.snapshot.toWalletName}`
  }
  if (item.kind === 'debtPayment') {
    return `Pago de ${formatCurrency(item.snapshot.amount, item.snapshot.currency)} a ${item.snapshot.counterpartyName}`
  }
  return `Aporte de ${formatCurrency(item.snapshot.amountSaved, item.snapshot.goalCurrency)} a "${item.snapshot.goalTitle}"`
})
</script>

<template>
  <BaseCard class="pending-sync-card" :class="`pending-sync-card--${item.status}`">
    <div class="pending-sync-card-header">
      <span class="pending-sync-badge">{{ item.status === 'failed' ? 'No se pudo sincronizar' : 'Pendiente' }}</span>
    </div>

    <p class="pending-sync-summary">{{ summary }}</p>

    <p v-if="item.kind === 'transfer'" class="pending-sync-transfer-warning">
      El dinero aún no se movió — se completa al reconectar.
    </p>

    <LoadingIndicator v-if="item.status === 'syncing'" label="Sincronizando..." size="1rem" />

    <template v-else-if="item.status === 'failed'">
      <p class="pending-sync-error" role="alert">{{ item.errorMessage }}</p>
      <div class="pending-sync-actions">
        <BaseButton type="button" variant="secondary" size="sm" @click="emit('discard', item.id)">Descartar</BaseButton>
        <BaseButton type="button" size="sm" @click="emit('retry', item.id)">Reintentar</BaseButton>
      </div>
    </template>

    <div v-else class="pending-sync-actions">
      <BaseButton type="button" variant="secondary" size="sm" @click="emit('discard', item.id)">Descartar</BaseButton>
    </div>
  </BaseCard>
</template>

<style scoped>
.pending-sync-card {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  border-style: dashed;
  opacity: 0.85;
}

.pending-sync-card--failed {
  opacity: 1;
}

.pending-sync-card-header {
  display: flex;
}

.pending-sync-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  border: 1px dashed var(--glass-border);
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.pending-sync-summary {
  font-size: 0.875rem;
  color: var(--text-h);
}

.pending-sync-transfer-warning {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.75rem;
}

.pending-sync-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.pending-sync-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
