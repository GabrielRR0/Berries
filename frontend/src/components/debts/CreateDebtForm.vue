<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { CreateDebtInput, DebtDirection } from '../../services/debts/interfaces/debts.interface'
import { SUPPORTED_CURRENCIES } from '../../utils/currency/supportedCurrencies'
import { groupAmountThousands, ungroupAmountThousands } from '../../utils/formatters/formatAmountInput'
import BaseButton from '../ui/BaseButton.vue'

// Formulario de alta de deuda (usado por DebtsMain.vue). Cuotas son
// deliberadamente opcionales: si se dejan vacias, se manda un CreateDebtInput
// sin installment_count/first_due_date/frequency_days y el backend crea una
// deuda de pago unico (installments: [] en la respuesta, ver contrato de
// POST /api/debts).
withDefaults(defineProps<{ submitting?: boolean }>(), { submitting: false })

const emit = defineEmits<{ create: [input: CreateDebtInput]; cancel: [] }>()

const form = reactive({
  counterpartyName: '',
  direction: 'owed_to_user' as DebtDirection,
  totalAmount: '',
  currency: 'USD',
  description: '',
  installmentCount: '',
  firstDueDate: '',
  frequencyDays: '',
})

// Idea de la sesion de brainstorm de UI: "1300" se veia feo sin separador de
// miles, mismo criterio ya usado en CreateGoalWizard.vue - el input real
// muestra la version agrupada ("1,300"), form.totalAmount se queda "crudo"
// (sin comas) para el resto del componente.
const totalAmountDisplay = computed({
  get: () => groupAmountThousands(form.totalAmount),
  set: (value: string) => {
    form.totalAmount = ungroupAmountThousands(value)
  },
})

function onSubmit() {
  const input: CreateDebtInput = {
    counterpartyName: form.counterpartyName.trim(),
    direction: form.direction,
    totalAmount: Number(form.totalAmount),
    currency: form.currency,
  }
  if (form.description.trim()) input.description = form.description.trim()
  if (form.installmentCount) input.installmentCount = Number(form.installmentCount)
  if (form.firstDueDate) input.firstDueDate = form.firstDueDate
  if (form.frequencyDays) input.frequencyDays = Number(form.frequencyDays)

  emit('create', input)
}
</script>

<template>
  <form class="create-debt-form" @submit.prevent="onSubmit">
    <label class="field">
      <span class="field-label">Nombre</span>
      <input v-model="form.counterpartyName" type="text" required placeholder="Ej. Juan Pérez" />
    </label>

    <label class="field">
      <span class="field-label">Dirección</span>
      <select v-model="form.direction">
        <option value="owed_to_user">Me deben</option>
        <option value="owed_by_user">Yo debo</option>
      </select>
    </label>

    <div class="field-row">
      <label class="field">
        <span class="field-label">Monto total</span>
        <input v-model="totalAmountDisplay" type="text" inputmode="decimal" required placeholder="0.00" />
      </label>

      <label class="field">
        <span class="field-label">Moneda</span>
        <select v-model="form.currency">
          <option v-for="option in SUPPORTED_CURRENCIES" :key="option.code" :value="option.code">
            {{ option.code }}
          </option>
        </select>
      </label>
    </div>

    <label class="field">
      <span class="field-label">Descripción (opcional)</span>
      <input v-model="form.description" type="text" placeholder="Detalle de la deuda" />
    </label>

    <p class="field-hint">Cuotas (opcional) - déjalo vacío para una deuda de pago único.</p>

    <div class="field-row">
      <label class="field">
        <span class="field-label">N.° de cuotas</span>
        <input v-model="form.installmentCount" type="number" min="1" step="1" placeholder="Ej. 6" />
      </label>

      <label class="field">
        <span class="field-label">Cada (días)</span>
        <input v-model="form.frequencyDays" type="number" min="1" step="1" placeholder="30" />
      </label>
    </div>

    <label class="field">
      <span class="field-label">Primer vencimiento</span>
      <input v-model="form.firstDueDate" type="date" />
    </label>

    <div class="form-actions">
      <BaseButton type="button" variant="secondary" :disabled="submitting" @click="emit('cancel')">
        Cancelar
      </BaseButton>
      <BaseButton type="submit" :disabled="submitting">
        {{ submitting ? 'Guardando...' : 'Crear deuda' }}
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.create-debt-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.field input,
.field select {
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  /* 1rem, no menos: evita el zoom automatico de iOS Safari al enfocar. */
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--accent);
}

.field-hint {
  margin-top: -0.375rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.form-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.form-actions :deep(.base-button) {
  width: 100%;
}
</style>
