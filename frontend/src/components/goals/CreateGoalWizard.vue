<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CreateGoalInput, GoalType, SavingsCapacity } from '../../services/goals/interfaces/goals.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { formatDate } from '../../utils/formatters/formatDate'
import { GOAL_TYPE_TEMPLATES } from '../../utils/goals/goalTypeTemplates'
import { monthsBetween } from '../../utils/goals/monthsBetween'
import BaseButton from '../ui/BaseButton.vue'
import AmountKeypad from './AmountKeypad.vue'
import GoalProgressRing from './GoalProgressRing.vue'
import GoalTypeIcon from './GoalTypeIcon.vue'

// Alta de meta en 3 pasos (pedido explicito del usuario, con capturas de
// referencia de otra app - layout solamente, paleta propia de Berry): 1)
// elegir una plantilla fija (o "Personalizada") - decide el icono que se
// guarda como goal_type, ver goal_model.py; 2) monto + titulo + fecha; 3)
// resumen antes de confirmar. Reemplaza la vieja pantalla unica de
// CreateGoalForm.vue (ahora EditGoalForm.vue, solo para editar - editar
// nunca cambia la plantilla/icono elegida aca).
const props = withDefaults(
  defineProps<{
    submitting?: boolean
    initialTitle?: string | null
    initialAmount?: number | null
    initialAmountIsMonthly?: boolean
    initialCurrency?: string
    initialTargetDate?: string | null
    savingsCapacity?: SavingsCapacity | null
  }>(),
  {
    submitting: false,
    initialTitle: null,
    initialAmount: null,
    initialAmountIsMonthly: false,
    initialCurrency: 'USD',
    initialTargetDate: null,
    savingsCapacity: null,
  },
)

const emit = defineEmits<{ create: [input: CreateGoalInput]; cancel: [] }>()

// Si ya llegan datos de voz desde el mount (no solo despues, ver el watch mas abajo -
// ese cubre "volver a grabar con el wizard ya abierto"), se salta el paso 1 directo.
const step = ref<1 | 2 | 3>(props.initialTitle || props.initialAmount !== null ? 2 : 1)

// Misma animacion "tipo pagina" que ya usa el resto de la app entre rutas (ver
// usePageTransition.ts/App.vue) - pedido explicito del usuario de que
// retroceder/avanzar entre pasos se sienta igual, aunque esto no navegue por
// vue-router (son las mismas 3 clases CSS globales .slide-left-*/.slide-right-*
// de style.css, aplicadas a mano en vez de por <RouterView>).
const stepTransitionName = ref<'slide-left' | 'slide-right'>('slide-left')
watch(step, (newStep, oldStep) => {
  stepTransitionName.value = newStep > oldStep ? 'slide-left' : 'slide-right'
})
const goalType = ref<GoalType>('custom')
const title = ref(props.initialTitle ?? '')
const currency = ref(props.initialCurrency)
const targetDate = ref(props.initialTargetDate ?? '')
const useMonthlyAmount = ref(props.initialAmountIsMonthly)
const totalAmountStr = ref(props.initialAmountIsMonthly ? '' : (props.initialAmount?.toString() ?? ''))
const monthlyAmountStr = ref(props.initialAmountIsMonthly ? (props.initialAmount?.toString() ?? '') : '')

// "Ya tengo $700 ahorrado (si vendo mi laptop)" - pedido explicito del usuario: un
// headstart opcional hacia la meta, con un detalle libre de donde sale. Se manda como
// initialAmount/initialAmountNote (ver goal_service.create_goal en el backend, que lo
// guarda como el primer GoalCheckIn de la meta). Colapsado por default - "Ya tengo
// algo ahorrado" es la excepcion, no el caso comun.
const hasInitialAmount = ref(false)
const initialAmountStr = ref('')
const initialAmountNote = ref('')

function clearInitialAmount() {
  hasInitialAmount.value = false
  initialAmountStr.value = ''
  initialAmountNote.value = ''
}

const initialAmountValue = computed(() => {
  if (!hasInitialAmount.value) return 0
  const value = Number(initialAmountStr.value)
  return Number.isFinite(value) && value > 0 ? value : 0
})

// El monto activo es el que edita el teclado numerico ahora mismo, segun el modo
// elegido - un solo AmountKeypad sirve para los dos casos.
const activeAmountStr = computed({
  get: () => (useMonthlyAmount.value ? monthlyAmountStr.value : totalAmountStr.value),
  set: (value: string) => {
    if (useMonthlyAmount.value) monthlyAmountStr.value = value
    else totalAmountStr.value = value
  },
})

function selectType(type: GoalType, defaultTitle: string) {
  goalType.value = type
  if (!title.value) title.value = defaultTitle
  step.value = 2
}

// Solo llamado desde el boton "←" de los pasos 2/3 (el paso 1 no tiene boton propio -
// cerrar el wizard entero se hace con la "X" del BottomSheet que lo contiene, ver
// GoalsMain.vue).
function goBack() {
  step.value -= 1
}

// Si llegan props de voz despues del mount (el usuario dicta con el wizard ya
// abierto), se saltea el paso 1 - la voz no elige plantilla, "custom" alcanza -
// y se prellenan los datos del paso 2 directo, igual criterio que el viejo
// CreateGoalForm.vue.
watch(
  () => [props.initialTitle, props.initialAmount, props.initialAmountIsMonthly, props.initialCurrency, props.initialTargetDate],
  () => {
    if (props.initialTitle) title.value = props.initialTitle
    currency.value = props.initialCurrency
    if (props.initialTargetDate) targetDate.value = props.initialTargetDate
    useMonthlyAmount.value = props.initialAmountIsMonthly
    if (props.initialAmount !== null) {
      if (props.initialAmountIsMonthly) monthlyAmountStr.value = props.initialAmount.toString()
      else totalAmountStr.value = props.initialAmount.toString()
    }
    if (props.initialTitle || props.initialAmount !== null) step.value = 2
  },
)

const monthsRemaining = computed(() => {
  if (!targetDate.value) return null
  const target = new Date(targetDate.value)
  if (Number.isNaN(target.getTime())) return null
  return monthsBetween(new Date(), target)
})

// Mismo calculo que contribution_calculator._months_between del backend (ver
// monthsBetween.ts) - previsualizacion en vivo del total cuando el usuario indica
// el aporte mensual en vez del monto total. En modo mensual el usuario nunca dicta
// el monto objetivo directamente - el objetivo es lo que el aporte mensual mas lo
// que ya tiene ahorrado van a sumar en total.
const computedTotalFromMonthly = computed(() => {
  if (!useMonthlyAmount.value || monthsRemaining.value === null) return null
  const monthly = Number(monthlyAmountStr.value)
  if (!Number.isFinite(monthly) || monthly <= 0) return null
  return monthly * monthsRemaining.value + initialAmountValue.value
})

const targetAmount = computed(() => {
  if (useMonthlyAmount.value) return computedTotalFromMonthly.value
  const total = Number(totalAmountStr.value)
  return Number.isFinite(total) && total > 0 ? total : null
})

// Cuanto falta reunir por mes descontando lo que ya se tiene ahorrado - mismo
// calculo que contribution_calculator.compute_monthly_contribution del backend
// ((target_amount - total_saved) / meses restantes).
const impliedMonthlyContribution = computed(() => {
  if (useMonthlyAmount.value) {
    const monthly = Number(monthlyAmountStr.value)
    return Number.isFinite(monthly) && monthly > 0 ? monthly : null
  }
  if (monthsRemaining.value === null || targetAmount.value === null) return null
  const remaining = Math.max(targetAmount.value - initialAmountValue.value, 0)
  return remaining / monthsRemaining.value
})

const exceedsAvailable = computed(() => {
  if (!props.savingsCapacity || impliedMonthlyContribution.value === null) return false
  return impliedMonthlyContribution.value > props.savingsCapacity.avgMonthlyAvailable
})

const canProceedStep2 = computed(
  () => title.value.trim() !== '' && !!targetDate.value && targetAmount.value !== null && targetAmount.value > 0,
)

function goToSummary() {
  if (canProceedStep2.value) step.value = 3
}

function onCreate() {
  if (!canProceedStep2.value || targetAmount.value === null) return
  emit('create', {
    title: title.value.trim(),
    targetAmount: targetAmount.value,
    currency: currency.value.trim().toUpperCase(),
    targetDate: targetDate.value,
    goalType: goalType.value,
    ...(initialAmountValue.value > 0 ? { initialAmount: initialAmountValue.value } : {}),
    ...(initialAmountValue.value > 0 && initialAmountNote.value.trim()
      ? { initialAmountNote: initialAmountNote.value.trim() }
      : {}),
  })
}
</script>

<template>
  <div class="goal-wizard">
    <div class="wizard-progress">
      <span v-for="n in 3" :key="n" class="wizard-progress-segment" :class="{ filled: n <= step }" />
    </div>

    <div class="wizard-steps-viewport">
    <Transition :name="stepTransitionName">
    <div v-if="step === 1" key="1" class="wizard-step">
      <h2 class="wizard-title">¿Cuál es tu objetivo?</h2>
      <p class="wizard-subtitle">Elige una opción o crea una meta personalizada</p>

      <div class="type-grid">
        <button
          v-for="template in GOAL_TYPE_TEMPLATES"
          :key="template.type"
          type="button"
          class="type-tile"
          @click="selectType(template.type, template.defaultTitle)"
        >
          <span class="type-tile-icon">
            <GoalTypeIcon :type="template.type" />
          </span>
          <span class="type-tile-label">{{ template.label }}</span>
        </button>

        <button type="button" class="type-tile type-tile-custom" @click="selectType('custom', '')">
          <span class="type-tile-icon custom-plus" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          </span>
          <span class="type-tile-label">Personalizada</span>
        </button>
      </div>
    </div>

    <div v-else-if="step === 2" key="2" class="wizard-step">
      <button type="button" class="wizard-back" @click="goBack" aria-label="Atrás">←</button>

      <div class="wizard-ring-wrap">
        <GoalProgressRing :percent="0" :size="88">
          <GoalTypeIcon :type="goalType" class="wizard-ring-icon" />
        </GoalProgressRing>
      </div>

      <p class="wizard-amount-display">{{ activeAmountStr || '0' }} {{ currency }}</p>
      <p class="wizard-amount-label">{{ useMonthlyAmount ? 'Aporte mensual' : 'Monto objetivo' }}</p>

      <div class="amount-mode-toggle">
        <button type="button" class="amount-mode-option" :class="{ active: !useMonthlyAmount }" @click="useMonthlyAmount = false">
          Monto total
        </button>
        <button type="button" class="amount-mode-option" :class="{ active: useMonthlyAmount }" @click="useMonthlyAmount = true">
          Aporte mensual
        </button>
      </div>

      <input v-model="title" type="text" class="wizard-title-input" placeholder="Nombre de la meta" maxlength="120" />

      <div class="wizard-pills-row">
        <label class="wizard-pill">
          <span>📅 {{ targetDate ? formatDate(targetDate) : 'Fecha objetivo' }}</span>
          <input v-model="targetDate" type="date" class="wizard-pill-input" required />
        </label>
        <label class="wizard-pill">
          <span>{{ currency || 'Moneda' }}</span>
          <input v-model="currency" type="text" class="wizard-pill-input" maxlength="4" />
        </label>
      </div>

      <div class="initial-savings-block">
        <button
          v-if="!hasInitialAmount"
          type="button"
          class="initial-savings-toggle"
          @click="hasInitialAmount = true"
        >
          + Ya tienes algo ahorrado para esto
        </button>

        <div v-else class="initial-savings-fields">
          <div class="initial-savings-header">
            <span class="field-label">Ya tienes ahorrado</span>
            <button type="button" class="initial-savings-remove" @click="clearInitialAmount">Quitar</button>
          </div>
          <input
            v-model="initialAmountStr"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            class="wizard-title-input"
            :placeholder="`0.00 ${currency}`"
          />
          <textarea
            v-model="initialAmountNote"
            class="wizard-title-input initial-savings-note"
            rows="2"
            maxlength="500"
            placeholder="Detalle (opcional). Ej.: si vendo mi laptop u otras pertenencias"
          />
        </div>
      </div>

      <p v-if="useMonthlyAmount && computedTotalFromMonthly !== null" class="wizard-hint">
        Total estimado: {{ formatCurrency(computedTotalFromMonthly, currency) }} en {{ monthsRemaining }}
        {{ monthsRemaining === 1 ? 'mes' : 'meses' }}.
      </p>

      <p v-if="savingsCapacity && impliedMonthlyContribution !== null" class="capacity-hint" :class="{ warning: exceedsAvailable }">
        <template v-if="exceedsAvailable">
          Esto es {{ formatCurrency(impliedMonthlyContribution, currency) }}/mes, más de lo que sueles tener disponible
          ({{ formatCurrency(savingsCapacity.avgMonthlyAvailable, currency) }}/mes en promedio).
        </template>
        <template v-else>
          Te quedan disponibles ~{{ formatCurrency(savingsCapacity.avgMonthlyAvailable, currency) }}/mes.
        </template>
      </p>

      <AmountKeypad v-model="activeAmountStr" />

      <BaseButton class="wizard-next" :disabled="!canProceedStep2" @click="goToSummary">Continuar</BaseButton>
    </div>

    <div v-else key="3" class="wizard-step">
      <button type="button" class="wizard-back" @click="goBack" aria-label="Atrás">←</button>

      <h2 class="wizard-title">Resumen de tu meta</h2>
      <p class="wizard-subtitle">Verifica los detalles antes de crear</p>

      <div class="wizard-ring-wrap">
        <GoalProgressRing :percent="0" :size="88">
          <GoalTypeIcon :type="goalType" class="wizard-ring-icon" />
        </GoalProgressRing>
      </div>

      <dl class="summary-list">
        <div class="summary-row">
          <dt>Nombre</dt>
          <dd>{{ title }}</dd>
        </div>
        <div class="summary-row">
          <dt>Monto objetivo</dt>
          <dd>{{ formatCurrency(targetAmount ?? 0, currency) }}</dd>
        </div>
        <div class="summary-row">
          <dt>Fecha objetivo</dt>
          <dd>{{ formatDate(targetDate) }}</dd>
        </div>
        <div v-if="impliedMonthlyContribution !== null" class="summary-row">
          <dt>Ahorro mensual</dt>
          <dd class="summary-highlight">{{ formatCurrency(impliedMonthlyContribution, currency) }} / mes</dd>
        </div>
        <div v-if="initialAmountValue > 0" class="summary-row">
          <dt>Ya tienes ahorrado</dt>
          <dd>{{ formatCurrency(initialAmountValue, currency) }}</dd>
        </div>
      </dl>

      <p v-if="initialAmountValue > 0 && initialAmountNote.trim()" class="wizard-hint">
        {{ initialAmountNote.trim() }}
      </p>

      <BaseButton class="wizard-next" :disabled="submitting" @click="onCreate">
        {{ submitting ? 'Creando...' : 'Crear meta' }}
      </BaseButton>
    </div>
    </Transition>
    </div>
  </div>
</template>

<style scoped>
.goal-wizard {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.wizard-progress {
  display: flex;
  gap: 0.375rem;
}

.wizard-progress-segment {
  flex: 1;
  height: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--border-subtle);
  transition: background-color var(--duration-base) var(--ease-out);
}

.wizard-progress-segment.filled {
  background: var(--accent);
}

/* Mismo contrato que .route-transition-viewport en style.css: position:relative
   + overflow-x:clip como contexto para que los pasos salientes/entrantes (ambos
   position:absolute durante la transicion, ver las clases de slide en
   style.css) no se recorten mal ni empujen el layout de costado. */
.wizard-steps-viewport {
  position: relative;
  overflow-x: clip;
}

.wizard-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.wizard-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-h);
}

.wizard-subtitle {
  margin-top: -0.5rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.wizard-back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
  font-size: 1.125rem;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.wizard-back:hover {
  opacity: 0.85;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.type-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 0.5rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.type-tile:hover {
  background: var(--bg-raised);
}

.type-tile:active {
  transform: scale(0.96);
}

.type-tile-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-pill);
  background: var(--accent-muted);
  color: var(--accent);
}

.type-tile-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.type-tile-custom {
  border-style: dashed;
  background: transparent;
}

.custom-plus {
  background: transparent;
  border: 1px dashed var(--accent-border);
}

.type-tile-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-h);
  text-align: center;
}

.wizard-ring-wrap {
  display: flex;
  justify-content: center;
}

.wizard-ring-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--accent);
}

.wizard-amount-display {
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-h);
}

.wizard-amount-label {
  margin-top: -0.75rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
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

.wizard-title-input {
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.wizard-title-input:focus {
  outline: none;
  border-color: var(--accent);
}

.wizard-pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.wizard-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.wizard-pill-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.initial-savings-toggle {
  align-self: flex-start;
  padding: 0.5rem 0.75rem;
  border: 1px dashed var(--accent-border);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.initial-savings-toggle:hover {
  background: var(--accent-muted);
}

.initial-savings-fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
}

.initial-savings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-h);
}

.initial-savings-remove {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out);
}

.initial-savings-remove:hover {
  color: var(--accent);
}

.initial-savings-note {
  resize: none;
  font-family: inherit;
}

.wizard-hint,
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

.wizard-next {
  width: 100%;
}

.summary-list {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  overflow: hidden;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}

.summary-row + .summary-row {
  border-top: 1px solid var(--border-subtle);
}

.summary-row dt {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.summary-row dd {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-h);
  text-align: right;
}

.summary-highlight {
  color: var(--accent);
}
</style>
