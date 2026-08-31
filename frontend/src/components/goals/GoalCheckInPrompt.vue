<script setup lang="ts">
import { ref } from 'vue'
import type { PendingCheckIn, RecordCheckInInput } from '../../services/goals/interfaces/goals.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import BaseCard from '../ui/BaseCard.vue'

// Card de chequeo mensual pendiente (usada por GoalsMain.vue) - pregunta si
// se reunio el aporte de este mes para una meta puntual, pedido explicito
// del usuario. Tarjeta dismissible, no un modal bloqueante (Berry no tiene
// modales forzados en ningun lado). Dos acciones: registrar el aporte tal
// cual, o posponer (revela fecha nueva + nota opcional).
const props = defineProps<{ pending: PendingCheckIn }>()

const emit = defineEmits<{ submit: [input: RecordCheckInInput] }>()

const amount = ref(props.pending.suggestedAmount.toString())
const showPostpone = ref(false)
const newTargetDate = ref('')
const note = ref('')

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const currentMonthLabel = MESES[new Date().getMonth()]

function submitRegular() {
  const value = Number(amount.value)
  emit('submit', { amountSaved: Number.isFinite(value) && value > 0 ? value : 0 })
}

function submitPostpone() {
  if (!newTargetDate.value) return
  const value = Number(amount.value)
  emit('submit', {
    amountSaved: Number.isFinite(value) && value > 0 ? value : 0,
    newTargetDate: newTargetDate.value,
    note: note.value.trim() || undefined,
  })
}
</script>

<template>
  <BaseCard class="check-in-prompt">
    <p class="check-in-question">
      ¿Reuniste tu aporte de {{ currentMonthLabel }} para "{{ pending.title }}"?
    </p>

    <label class="check-in-amount-field">
      <span class="check-in-amount-label">Monto reunido este mes</span>
      <input v-model="amount" type="number" min="0" step="0.01" inputmode="decimal" />
      <span class="check-in-suggested">
        Sugerido: {{ formatCurrency(pending.suggestedAmount, pending.currency) }}
      </span>
    </label>

    <div v-if="!showPostpone" class="check-in-actions">
      <button type="button" class="check-in-register" @click="submitRegular">Registrar</button>
      <button type="button" class="check-in-postpone-trigger" @click="showPostpone = true">Posponer</button>
    </div>

    <div v-else class="check-in-postpone-form">
      <label class="check-in-postpone-field">
        <span class="check-in-amount-label">Nueva fecha objetivo</span>
        <input v-model="newTargetDate" type="date" />
      </label>
      <label class="check-in-postpone-field">
        <span class="check-in-amount-label">Nota (opcional)</span>
        <input v-model="note" type="text" placeholder="¿Qué pasó este mes?" />
      </label>
      <div class="check-in-actions">
        <button type="button" class="check-in-register" @click="submitPostpone">Confirmar postergación</button>
        <button type="button" class="check-in-postpone-trigger" @click="showPostpone = false">Volver</button>
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.check-in-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.check-in-question {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
  line-height: 1.4;
}

.check-in-amount-field,
.check-in-postpone-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.check-in-amount-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

.check-in-amount-field input,
.check-in-postpone-field input {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.check-in-amount-field input:focus,
.check-in-postpone-field input:focus {
  outline: none;
  border-color: var(--accent);
}

.check-in-suggested {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.check-in-postpone-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.check-in-actions {
  display: flex;
  gap: 0.625rem;
}

.check-in-register {
  flex: 1;
  padding: 0.625rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-contrast);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.check-in-postpone-trigger {
  flex: 1;
  padding: 0.625rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  color: var(--text-h);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.check-in-register:hover,
.check-in-postpone-trigger:hover {
  opacity: 0.9;
}
</style>
