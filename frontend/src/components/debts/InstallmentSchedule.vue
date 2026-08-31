<script setup lang="ts">
import type { Installment } from '../../services/debts/interfaces/debts.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { formatDate } from '../../utils/formatters/formatDate'

// Lista de cuotas de una deuda (usada por DebtCard.vue). Cada fila muestra
// vencimiento/monto/estado y un boton pagar/despagar - el estado real vive
// en useDebts (composable del padre), este componente solo emite la
// intencion.
withDefaults(defineProps<{ installments: Installment[]; currency?: string }>(), { currency: 'USD' })

const emit = defineEmits<{ pay: [installmentId: string]; unpay: [installmentId: string] }>()
</script>

<template>
  <ul class="installment-schedule">
    <li v-for="installment in installments" :key="installment.id" class="installment-row">
      <div class="installment-info">
        <span class="installment-due">{{ formatDate(installment.dueDate) }}</span>
        <span class="installment-amount">{{ formatCurrency(installment.amount, currency) }}</span>
      </div>

      <div class="installment-actions">
        <span class="installment-status" :class="{ paid: installment.status === 'paid' }">
          {{ installment.status === 'paid' ? 'Pagada' : 'Pendiente' }}
        </span>

        <button
          v-if="installment.status === 'pending'"
          type="button"
          class="installment-button"
          @click="emit('pay', installment.id)"
        >
          Pagar
        </button>
        <button v-else type="button" class="installment-button secondary" @click="emit('unpay', installment.id)">
          Deshacer
        </button>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.installment-schedule {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
}

.installment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.installment-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.installment-due {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-h);
}

.installment-amount {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.installment-actions {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.installment-status {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
}

.installment-status.paid {
  color: var(--text-muted);
}

.installment-button {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-contrast);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.installment-button.secondary {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: 1px solid var(--glass-border);
  color: var(--text-h);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .installment-button.secondary {
    background: var(--bg-surface);
  }
}

.installment-button:hover {
  opacity: 0.85;
}

.installment-button:active {
  transform: scale(0.94);
}
</style>
