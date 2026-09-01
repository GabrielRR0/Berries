<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { Goal, SavingsCapacity, UpdateGoalInput } from '../../services/goals/interfaces/goals.interface'
import { SUPPORTED_CURRENCIES } from '../../utils/currency/supportedCurrencies'
import { groupAmountThousands, ungroupAmountThousands } from '../../utils/formatters/formatAmountInput'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { formatDate } from '../../utils/formatters/formatDate'
import { monthsBetween } from '../../utils/goals/monthsBetween'
import BaseButton from '../ui/BaseButton.vue'

// Formulario de EDICION de una meta existente (ver goal_service.update_goal en el
// backend: edicion siempre silenciosa, sin fila de historial, y sin poder cambiar
// goal_type/icono una vez creada - eso solo se elige en CreateGoalWizard.vue). Antes
// este mismo archivo tambien manejaba el alta, con un prop isEditing - se separo
// porque el alta ahora es un wizard de 3 pasos con su propia UI (grid de plantillas +
// teclado numerico), muy distinta a este formulario simple de una sola pantalla.
const props = withDefaults(
  defineProps<{ goal: Goal; submitting?: boolean; savingsCapacity?: SavingsCapacity | null }>(),
  { submitting: false, savingsCapacity: null },
)

const emit = defineEmits<{ submit: [input: UpdateGoalInput]; cancel: [] }>()

const form = reactive({
  title: props.goal.title,
  currency: props.goal.currency,
  targetDate: props.goal.targetDate,
  useMonthlyAmount: false,
  totalAmount: props.goal.targetAmount.toString(),
  monthlyAmount: '',
})

// Lo que cada input MUESTRA (con comas de miles, ej. "1,300") - distinto del
// string "crudo" (form.totalAmount/form.monthlyAmount, sin comas) que usa el
// resto del componente para calcular. Mismo criterio que CreateGoalWizard.vue
// (pedido explicito del usuario, mismo separador que ya usa formatCurrency.ts
// para USD en el resto de la app).
const displayTotalAmount = computed({
  get: () => groupAmountThousands(form.totalAmount),
  set: (value: string) => {
    form.totalAmount = ungroupAmountThousands(value)
  },
})
const displayMonthlyAmount = computed({
  get: () => groupAmountThousands(form.monthlyAmount),
  set: (value: string) => {
    form.monthlyAmount = ungroupAmountThousands(value)
  },
})

const monthsRemaining = computed(() => {
  if (!form.targetDate) return null
  const target = new Date(form.targetDate)
  if (Number.isNaN(target.getTime())) return null
  return monthsBetween(new Date(), target)
})

// Previsualizacion en vivo del total cuando el usuario indica el aporte
// mensual en vez del monto total - mismo calculo que
// contribution_calculator._months_between del backend (ver monthsBetween.ts).
// Suma goal.totalSaved (lo ya reunido via check-ins) - mismo criterio que
// CreateGoalWizard.vue con initialAmount: en este modo el usuario dicta el
// aporte, no el objetivo, asi que el objetivo resultante es lo que ya tiene
// mas lo que va a seguir aportando (bug real: antes NO lo sumaba, asi que
// bajar el objetivo por debajo de lo ya ahorrado completaba la meta de una).
const computedTotalFromMonthly = computed(() => {
  if (!form.useMonthlyAmount || monthsRemaining.value === null) return null
  const monthly = Number(form.monthlyAmount)
  if (!Number.isFinite(monthly) || monthly <= 0) return null
  return monthly * monthsRemaining.value + props.goal.totalSaved
})

const targetAmountValue = computed(() => {
  if (form.useMonthlyAmount) return computedTotalFromMonthly.value
  const total = Number(form.totalAmount)
  return Number.isFinite(total) && total > 0 ? total : null
})

function onSubmit() {
  const targetAmount = targetAmountValue.value
  if (!targetAmount || targetAmount <= 0 || !form.targetDate) return

  emit('submit', {
    title: form.title.trim(),
    targetAmount,
    currency: form.currency.trim().toUpperCase(),
    targetDate: form.targetDate,
  })
}

// Aporte mensual implicito con los datos actuales del formulario, sea cual
// sea el modo elegido - mismo calculo que contribution_calculator.py
// (target_amount - total_saved, repartido entre los meses restantes), para
// poder comparar contra lo disponible en vivo mientras el usuario completa
// el formulario (no solo despues de guardar).
const impliedMonthlyContribution = computed(() => {
  if (form.useMonthlyAmount) {
    const monthly = Number(form.monthlyAmount)
    return Number.isFinite(monthly) && monthly > 0 ? monthly : null
  }
  if (monthsRemaining.value === null || targetAmountValue.value === null) return null
  const remaining = Math.max(targetAmountValue.value - props.goal.totalSaved, 0)
  return remaining / monthsRemaining.value
})

// Explicacion completa del plan en modo "Monto total" - mismo criterio que
// CreateGoalWizard.vue (bug real, reportado por el usuario editando una meta
// real: antes este modo no mostraba ningun texto explicativo). Siempre dice
// cuantos meses quedan, el promedio necesario, y si ese promedio sumado a lo
// ya ahorrado (goal.totalSaved) completa la meta a tiempo.
const totalModeHintText = computed(() => {
  if (form.useMonthlyAmount) return null
  if (monthsRemaining.value === null || targetAmountValue.value === null || impliedMonthlyContribution.value === null) {
    return null
  }

  if (props.goal.totalSaved >= targetAmountValue.value) {
    return (
      `Ya tienes ahorrado ${formatCurrency(props.goal.totalSaved, form.currency)}, que cubre por completo tu meta de ` +
      `${formatCurrency(targetAmountValue.value, form.currency)}. No necesitas ahorrar nada más antes del ${formatDate(form.targetDate)}.`
    )
  }

  const monthsLabel = monthsRemaining.value === 1 ? 'mes' : 'meses'
  const savedClause =
    props.goal.totalSaved > 0
      ? `, sumando los ${formatCurrency(props.goal.totalSaved, form.currency)} que ya tienes ahorrados`
      : ''
  return (
    `Te faltan ${monthsRemaining.value} ${monthsLabel} hasta el ${formatDate(form.targetDate)}. ` +
    `Para reunir ${formatCurrency(targetAmountValue.value, form.currency)} necesitas ahorrar un promedio de ` +
    `${formatCurrency(impliedMonthlyContribution.value, form.currency)} al mes${savedClause}. ` +
    `Ahorrando ese promedio, completarías tu meta a tiempo.`
  )
})

// Mismo criterio en modo "Aporte mensual".
const monthlyModeHintText = computed(() => {
  if (!form.useMonthlyAmount) return null
  if (monthsRemaining.value === null || computedTotalFromMonthly.value === null || impliedMonthlyContribution.value === null) {
    return null
  }

  const monthsLabel = monthsRemaining.value === 1 ? 'mes' : 'meses'
  const savedClause =
    props.goal.totalSaved > 0
      ? ` (más los ${formatCurrency(props.goal.totalSaved, form.currency)} que ya tienes ahorrados)`
      : ''
  return (
    `Aportando ${formatCurrency(impliedMonthlyContribution.value, form.currency)} al mes durante ${monthsRemaining.value} ${monthsLabel}` +
    `${savedClause}, vas a reunir ${formatCurrency(computedTotalFromMonthly.value, form.currency)} para el ${formatDate(form.targetDate)}.`
  )
})

// Aviso puramente informativo (nunca bloquea el guardado) - pedido
// explicito del usuario de que la recomendacion tome en cuenta lo que gasta
// y gana al mes, no solo la fecha objetivo. savingsCapacity llega ya
// calculado del backend (promedio real de los ultimos meses).
// hasEnoughHistory=false (cuenta nueva, el mes en curso todavia no termino) -
// mismo criterio que CreateGoalWizard.vue/GoalCard.vue: no avisar nada con una
// sola cifra parcial que no es un promedio real (pedido explicito del usuario).
const exceedsAvailable = computed(() => {
  if (!props.savingsCapacity?.hasEnoughHistory || impliedMonthlyContribution.value === null) return false
  return impliedMonthlyContribution.value > props.savingsCapacity.avgMonthlyAvailable
})
</script>

<template>
  <form class="edit-goal-form" @submit.prevent="onSubmit">
    <label class="field">
      <span class="field-label">¿Qué quieres comprar?</span>
      <input v-model="form.title" type="text" required placeholder="Ej. TV, MacBook, la inicial de una moto" />
    </label>

    <label class="field">
      <span class="field-label">Fecha objetivo</span>
      <input v-model="form.targetDate" type="date" required />
    </label>

    <div class="amount-mode-toggle">
      <button
        type="button"
        class="amount-mode-option"
        :class="{ active: !form.useMonthlyAmount }"
        @click="form.useMonthlyAmount = false"
      >
        Indicar el monto total
      </button>
      <button
        type="button"
        class="amount-mode-option"
        :class="{ active: form.useMonthlyAmount }"
        @click="form.useMonthlyAmount = true"
      >
        Prefiero indicar el aporte mensual
      </button>
    </div>

    <div class="field-row">
      <label v-if="!form.useMonthlyAmount" class="field">
        <span class="field-label">Monto total</span>
        <input v-model="displayTotalAmount" type="text" inputmode="decimal" required placeholder="0.00" class="amount-input" />
      </label>
      <label v-else class="field">
        <span class="field-label">Aporte mensual</span>
        <input v-model="displayMonthlyAmount" type="text" inputmode="decimal" required placeholder="0.00" class="amount-input" />
      </label>

      <label class="field">
        <span class="field-label">Moneda</span>
        <select v-model="form.currency" required>
          <option v-for="option in SUPPORTED_CURRENCIES" :key="option.code" :value="option.code">{{ option.code }}</option>
        </select>
      </label>
    </div>

    <p v-if="totalModeHintText" class="field-hint">{{ totalModeHintText }}</p>
    <p v-if="monthlyModeHintText" class="field-hint">{{ monthlyModeHintText }}</p>

    <p
      v-if="savingsCapacity?.hasEnoughHistory && impliedMonthlyContribution !== null"
      class="capacity-hint"
      :class="{ warning: exceedsAvailable }"
    >
      <template v-if="exceedsAvailable">
        Esto es {{ formatCurrency(impliedMonthlyContribution, form.currency) }}/mes, más de lo que sueles tener
        disponible ({{ formatCurrency(savingsCapacity.avgMonthlyAvailable, form.currency) }}/mes en promedio). Puedes
        elegir una fecha más lejana o ajustar el monto.
      </template>
      <template v-else>
        Según tus ingresos y gastos de los últimos meses, te quedan disponibles ~{{
          formatCurrency(savingsCapacity.avgMonthlyAvailable, form.currency)
        }}/mes.
      </template>
    </p>

    <div class="form-actions">
      <BaseButton type="button" variant="secondary" :disabled="submitting" @click="emit('cancel')">
        Cancelar
      </BaseButton>
      <BaseButton type="submit" :disabled="submitting">
        {{ submitting ? 'Guardando...' : 'Guardar cambios' }}
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.edit-goal-form {
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

.amount-mode-toggle {
  display: flex;
  gap: 0.375rem;
  padding: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}

.amount-mode-option {
  flex: 1;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.amount-mode-option.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

.field-hint {
  margin-top: -0.375rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.capacity-hint {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--bg-inset);
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.capacity-hint.warning {
  border-color: var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
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
