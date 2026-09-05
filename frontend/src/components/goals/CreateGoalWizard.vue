<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getWalletCommitments } from '../../services/goals/goals.service'
import type { CreateGoalInput, GoalType, SavingsCapacity } from '../../services/goals/interfaces/goals.interface'
import { useWalletsStore } from '../../stores/wallets.store'
import { SUPPORTED_CURRENCIES } from '../../utils/currency/supportedCurrencies'
import { groupAmountThousands, ungroupAmountThousands } from '../../utils/formatters/formatAmountInput'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { formatDate } from '../../utils/formatters/formatDate'
import { GOAL_TYPE_TEMPLATES } from '../../utils/goals/goalTypeTemplates'
import { monthsBetween } from '../../utils/goals/monthsBetween'
import { currenciesAreEquivalent } from '../../utils/currency/currencyEquivalence'
import { availableBalance } from '../../utils/wallets/availableBalance'
import BaseButton from '../ui/BaseButton.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import PillToggle from '../ui/PillToggle.vue'
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
// guarda como el primer GoalCheckIn de la meta). Vive en un BottomSheet aparte, no
// inline en el paso 2 (pedido explicito del usuario, segunda vuelta: "tal vez que sea
// una modal que aparezca desde abajo") - mismo componente que ya usa el resto de la
// app (historial de pagos de deudas, resumen de ingresos/gastos, etc.), asi que el
// estilo ya sale correcto tanto en telefono como en escritorio sin nada especial aca.
// hasInitialAmount/initialAmountStr/initialAmountNote son el valor YA CONFIRMADO;
// draftInitialAmountStr/draftInitialAmountNote son el borrador que se edita dentro
// del sheet mientras esta abierto - "Cancelar" descarta el borrador sin tocar lo ya
// confirmado, solo "Guardar" lo comitea.
const hasInitialAmount = ref(false)
const initialAmountStr = ref('')
const initialAmountNote = ref('')
// De donde sale ese aporte inicial - pedido explicito del usuario: "puede ser de
// alguna billetera, o de un ingreso futuro". "future" por default: nadie que ignore
// esto nota un cambio (el aporte sigue guardandose igual que antes, solo con nota).
const initialAmountSourceType = ref<'wallet' | 'future'>('future')
const initialAmountWalletId = ref<string | null>(null)

const showInitialSavingsSheet = ref(false)
const draftInitialAmountStr = ref('')
const draftInitialAmountNote = ref('')
const draftInitialAmountSourceType = ref<'wallet' | 'future'>('future')
const draftInitialAmountWalletId = ref<string | null>(null)

// Este wizard no comparte instancia de useGoals() con GoalsMain.vue (vive en su
// propia ruta, ver CreateGoalView.vue) - hace su propio fetch de billeteras y de lo
// ya comprometido en otras metas, igual criterio que TransferForm.vue con
// useWalletsStore().
const walletsStore = useWalletsStore()
const walletCommitments = ref<Record<string, number>>({})
onMounted(async () => {
  await walletsStore.fetchWallets()
  try {
    const commitments = await getWalletCommitments()
    walletCommitments.value = Object.fromEntries(commitments.map((c) => [c.walletId, c.committedAmount]))
  } catch {
    // Best-effort: si falla, el selector de billeteras simplemente no muestra
    // "disponible" pero el resto del wizard sigue funcionando.
  }
})

// Solo billeteras de la MISMA moneda que la meta (o el par USD/USDT, atado 1:1 -
// pedido explicito del usuario: "si es dolares, acepte dolares y usdt", mismo
// criterio ya establecido en AddDebtPaymentForm.vue) - confirmado: sin conversion
// real para el resto de las monedas en esta pasada.
const walletsForInitialAmount = computed(() =>
  walletsStore.wallets.filter((wallet) => currenciesAreEquivalent(wallet.currency, currency.value)),
)

const draftInitialAmountDisplayStr = computed({
  get: () => groupAmountThousands(draftInitialAmountStr.value),
  set: (value: string) => {
    draftInitialAmountStr.value = ungroupAmountThousands(value)
  },
})

function openInitialSavingsSheet() {
  draftInitialAmountStr.value = initialAmountStr.value
  draftInitialAmountNote.value = initialAmountNote.value
  draftInitialAmountSourceType.value = initialAmountSourceType.value
  draftInitialAmountWalletId.value = initialAmountWalletId.value
  showInitialSavingsSheet.value = true
}

// Disponible de la billetera elegida en el borrador - null si no eligio ninguna.
const draftInitialAmountWalletAvailable = computed(() => {
  const wallet = walletsForInitialAmount.value.find((w) => w.id === draftInitialAmountWalletId.value)
  return wallet ? availableBalance(wallet, walletCommitments.value) : null
})

// Bloquea "Guardar" si eligio "Billetera" pero no selecciono ninguna, o si el monto
// supera el disponible de la elegida - pedido explicito del usuario: "si no tengo
// dinero en esa billetera no se podria enlazar".
const canConfirmInitialSavings = computed(() => {
  if (draftInitialAmountSourceType.value !== 'wallet') return true
  if (draftInitialAmountWalletId.value === null) return false
  const amount = Number(draftInitialAmountStr.value)
  return draftInitialAmountWalletAvailable.value !== null && amount <= draftInitialAmountWalletAvailable.value
})

function confirmInitialSavings() {
  initialAmountStr.value = draftInitialAmountStr.value
  initialAmountNote.value = draftInitialAmountNote.value
  initialAmountSourceType.value = draftInitialAmountSourceType.value
  initialAmountWalletId.value = draftInitialAmountSourceType.value === 'wallet' ? draftInitialAmountWalletId.value : null
  hasInitialAmount.value = Number(draftInitialAmountStr.value) > 0
  showInitialSavingsSheet.value = false
}

function clearInitialAmount() {
  hasInitialAmount.value = false
  initialAmountStr.value = ''
  initialAmountNote.value = ''
  initialAmountSourceType.value = 'future'
  initialAmountWalletId.value = null
}

const initialAmountValue = computed(() => {
  if (!hasInitialAmount.value) return 0
  const value = Number(initialAmountStr.value)
  return Number.isFinite(value) && value > 0 ? value : 0
})

// El monto activo es el que edita el input nativo ahora mismo, segun el modo
// elegido - pedido explicito del usuario: sacar los botones de numero propios y
// usar el teclado real del telefono (el teclado a medida tenia ademas un bug real
// donde solo dejaba escribir un digito y se trababa).
const activeAmountStr = computed({
  get: () => (useMonthlyAmount.value ? monthlyAmountStr.value : totalAmountStr.value),
  set: (value: string) => {
    if (useMonthlyAmount.value) monthlyAmountStr.value = value
    else totalAmountStr.value = value
  },
})

// Lo que el input MUESTRA (con comas de miles, ej. "1,300") - distinto del
// string "crudo" (activeAmountStr, sin comas) que usa el resto del componente
// para calcular. Pedido explicito del usuario: "1300" se veia feo sin
// separador de miles, mismo criterio de coma que ya usa formatCurrency.ts
// para USD en el resto de la app.
const displayAmountStr = computed({
  get: () => groupAmountThousands(activeAmountStr.value),
  set: (value: string) => {
    activeAmountStr.value = ungroupAmountThousands(value)
  },
})

// El pill de fecha es un <input type="date"> invisible superpuesto sobre el
// <span> visible (mismo patron que el pill de moneda) - pero en Chrome
// moderno clickear CUALQUIER parte de un date input solo abre el calendario
// si el click cae justo sobre el icono interno del picker, no en cualquier
// punto de la caja. Como esa caja esta estirada e invisible sobre todo el
// pill, la mayoria de los clicks no pegaban ahi - "no pasa nada" (bug real
// reportado por el usuario). showPicker() lo abre a mano sin importar donde
// se hizo click adentro del pill.
function openDatePicker(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  input.showPicker?.()
}

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

// Explicacion completa del plan en modo "Monto total" - pedido explicito del usuario:
// antes solo se veia "esto es $360/mes" (y solo si habia datos de capacidad de ahorro
// disponibles - si no habia, no se explicaba nada). Ahora siempre dice cuantos meses
// quedan hasta la fecha, el promedio necesario, y si ese promedio sumado a lo ya
// ahorrado alcanza para completar la meta a tiempo.
const totalModeHintText = computed(() => {
  if (useMonthlyAmount.value) return null
  if (monthsRemaining.value === null || targetAmount.value === null || impliedMonthlyContribution.value === null) return null

  if (initialAmountValue.value >= targetAmount.value) {
    return (
      `Ya tienes ahorrado ${formatCurrency(initialAmountValue.value, currency.value)}, que cubre por completo tu meta de ` +
      `${formatCurrency(targetAmount.value, currency.value)}. No necesitas ahorrar nada más antes del ${formatDate(targetDate.value)}.`
    )
  }

  const monthsLabel = monthsRemaining.value === 1 ? 'mes' : 'meses'
  const initialClause =
    initialAmountValue.value > 0
      ? `, sumando los ${formatCurrency(initialAmountValue.value, currency.value)} que ya tienes ahorrados`
      : ''
  return (
    `Te faltan ${monthsRemaining.value} ${monthsLabel} hasta el ${formatDate(targetDate.value)}. ` +
    `Para reunir ${formatCurrency(targetAmount.value, currency.value)} necesitas ahorrar un promedio de ` +
    `${formatCurrency(impliedMonthlyContribution.value, currency.value)} al mes${initialClause}. ` +
    `Ahorrando ese promedio, completarías tu meta a tiempo.`
  )
})

// Mismo criterio en modo "Aporte mensual", donde el usuario dicta el aporte y el total
// se deriva - deja explicito cuanto se junta y para cuando.
const monthlyModeHintText = computed(() => {
  if (!useMonthlyAmount.value) return null
  if (monthsRemaining.value === null || computedTotalFromMonthly.value === null || impliedMonthlyContribution.value === null) {
    return null
  }

  const monthsLabel = monthsRemaining.value === 1 ? 'mes' : 'meses'
  const initialClause =
    initialAmountValue.value > 0
      ? ` (más los ${formatCurrency(initialAmountValue.value, currency.value)} que ya tienes ahorrados)`
      : ''
  return (
    `Aportando ${formatCurrency(impliedMonthlyContribution.value, currency.value)} al mes durante ${monthsRemaining.value} ${monthsLabel}` +
    `${initialClause}, vas a reunir ${formatCurrency(computedTotalFromMonthly.value, currency.value)} para el ${formatDate(targetDate.value)}.`
  )
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
    ...(initialAmountValue.value > 0 && initialAmountWalletId.value
      ? { initialAmountWalletId: initialAmountWalletId.value }
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
        <GoalProgressRing :percent="0" :size="56">
          <GoalTypeIcon :type="goalType" class="wizard-ring-icon" />
        </GoalProgressRing>
      </div>

      <div class="wizard-amount-input-wrap">
        <input
          v-model="displayAmountStr"
          type="text"
          inputmode="decimal"
          placeholder="0"
          size="8"
          class="wizard-amount-input"
        />
        <span class="wizard-amount-currency">{{ currency }}</span>
      </div>
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
          <input v-model="targetDate" type="date" class="wizard-pill-input" required @click="openDatePicker" />
        </label>
        <label class="wizard-pill">
          <span>{{ currency || 'Moneda' }}</span>
          <select v-model="currency" class="wizard-pill-input">
            <option v-for="option in SUPPORTED_CURRENCIES" :key="option.code" :value="option.code">
              {{ option.code }}
            </option>
          </select>
        </label>
      </div>

      <div class="initial-savings-block">
        <button
          v-if="initialAmountValue <= 0"
          type="button"
          class="initial-savings-toggle"
          @click="openInitialSavingsSheet"
        >
          + Ya tienes algo ahorrado para esto
        </button>

        <div v-else class="initial-savings-summary">
          <span class="initial-savings-summary-text">Ya tienes ahorrado: {{ formatCurrency(initialAmountValue, currency) }}</span>
          <div class="initial-savings-summary-actions">
            <button type="button" class="initial-savings-edit" @click="openInitialSavingsSheet">Editar</button>
            <button type="button" class="initial-savings-remove" @click="clearInitialAmount">Quitar</button>
          </div>
        </div>
      </div>

      <!-- <Teleport to="body">: mismo motivo que en DebtCard.vue - un ancestro con
           transform activo (los pasos del wizard lo tienen mientras dura el slide
           entre pasos, ver .slide-left-*/.slide-right-* en style.css) redefine el
           containing block de un position:fixed anidado adentro (el .sheet-scrim de
           BottomSheet.vue). -->
      <Teleport to="body">
        <BottomSheet v-if="showInitialSavingsSheet" title="Ya tienes ahorrado" @close="showInitialSavingsSheet = false">
          <div class="initial-savings-sheet-body">
            <input
              v-model="draftInitialAmountDisplayStr"
              type="text"
              inputmode="decimal"
              class="wizard-title-input initial-savings-amount-input"
              :placeholder="`0.00 ${currency}`"
            />

            <!-- De donde sale ese aporte - pedido explicito del usuario: "puede ser
                 de alguna billetera, o de un ingreso futuro". -->
            <PillToggle
              :options="[
                { value: 'wallet', label: 'Billetera' },
                { value: 'future', label: 'Ingreso futuro' },
              ]"
              v-model="draftInitialAmountSourceType"
              class="initial-savings-source-toggle"
            />

            <div v-if="draftInitialAmountSourceType === 'wallet'" class="initial-savings-wallet-field">
              <select v-model="draftInitialAmountWalletId" class="wizard-title-input">
                <option :value="null" disabled>Elige una billetera</option>
                <option v-for="wallet in walletsForInitialAmount" :key="wallet.id" :value="wallet.id">
                  {{ wallet.name }} — disponible {{ formatCurrency(availableBalance(wallet, walletCommitments), wallet.currency) }}
                </option>
              </select>
              <p v-if="walletsForInitialAmount.length === 0" class="wizard-hint">
                No tienes billeteras en {{ currency }} todavía.
              </p>
              <p
                v-else-if="draftInitialAmountWalletId !== null && !canConfirmInitialSavings"
                class="capacity-hint warning"
              >
                Esa billetera no tiene disponible suficiente para este monto.
              </p>
            </div>

            <textarea
              v-else
              v-model="draftInitialAmountNote"
              class="wizard-title-input initial-savings-note"
              rows="3"
              maxlength="500"
              placeholder="¿De dónde sale? (opcional)"
            />
            <div class="initial-savings-sheet-actions">
              <BaseButton variant="secondary" @click="showInitialSavingsSheet = false">Cancelar</BaseButton>
              <BaseButton :disabled="!canConfirmInitialSavings" @click="confirmInitialSavings">Guardar</BaseButton>
            </div>
          </div>
        </BottomSheet>
      </Teleport>

      <p v-if="totalModeHintText" class="wizard-hint">{{ totalModeHintText }}</p>
      <p v-if="monthlyModeHintText" class="wizard-hint">{{ monthlyModeHintText }}</p>

      <p
        v-if="savingsCapacity?.hasEnoughHistory && impliedMonthlyContribution !== null"
        class="capacity-hint"
        :class="{ warning: exceedsAvailable }"
      >
        <template v-if="exceedsAvailable">
          Ese promedio es más de lo que sueles tener disponible por mes
          ({{ formatCurrency(savingsCapacity.avgMonthlyAvailable, currency) }}/mes en promedio) - vas a necesitar ahorrar más de lo
          habitual, o mover la fecha.
        </template>
        <template v-else>
          Te quedan disponibles ~{{ formatCurrency(savingsCapacity.avgMonthlyAvailable, currency) }}/mes en promedio, así que este
          ritmo es alcanzable.
        </template>
      </p>

      <BaseButton class="wizard-next" :disabled="!canProceedStep2" @click="goToSummary">Continuar</BaseButton>
    </div>

    <div v-else key="3" class="wizard-step">
      <button type="button" class="wizard-back" @click="goBack" aria-label="Atrás">←</button>

      <h2 class="wizard-title">Resumen de tu meta</h2>
      <p class="wizard-subtitle">Verifica los detalles antes de crear</p>

      <div class="wizard-ring-wrap">
        <GoalProgressRing :percent="0" :size="56">
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
        <div v-if="initialAmountValue > 0" class="summary-row">
          <dt>Fuente</dt>
          <dd>
            {{
              initialAmountWalletId
                ? walletsStore.wallets.find((w) => w.id === initialAmountWalletId)?.name
                : 'Ingreso futuro'
            }}
          </dd>
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
  gap: 0.875rem;
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
  gap: 0.75rem;
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
  width: 1rem;
  height: 1rem;
  color: var(--accent);
}

.wizard-amount-input-wrap {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
}

.wizard-amount-input {
  /* Sin ancho fijo - el atributo size="8" (ver template) lo dimensiona a su
     contenido, para que el numero quede realmente centrado bajo el aro/icono
     de arriba en vez de quedar pegado al borde derecho de una caja ancha con
     hueco vacio a la izquierda (bug real reportado por el usuario). type="text"
     (no "number"): un input number no puede mostrar comas de agrupamiento de
     miles (otro pedido explicito del usuario) - inputmode="decimal" en el
     template sigue trayendo el teclado numerico en el telefono igual. */
  min-width: 0;
  padding: 0.375rem 0;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text-h);
  font: inherit;
  font-size: 1.75rem;
  font-weight: 700;
  text-align: center;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.wizard-amount-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* Pisa el aro de foco global (ver style.css: input:focus-visible{box-shadow:
   var(--focus-ring)}) - pensado para inputs con caja/fondo visible; sobre este
   input transparente sin bordes laterales se veia como un recuadro feo
   saliendo de la nada (bug real reportado por el usuario). El cambio de color
   del borde de abajo (arriba) ya alcanza como señal de foco. */
.wizard-amount-input:focus-visible {
  box-shadow: none;
}

.wizard-amount-currency {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-muted);
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

/* Resumen compacto de una linea una vez confirmado el monto (mismo criterio
   que DebtCard.vue con su historial de pagos: un trigger/resumen chico en vez
   de dejar el formulario entero siempre desplegado en el paso). El
   formulario en si vive en el BottomSheet, ver mas abajo. */
.initial-savings-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
}

.initial-savings-summary-text {
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.initial-savings-summary-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.75rem;
}

.initial-savings-edit,
.initial-savings-remove {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.initial-savings-edit {
  color: var(--accent);
}

.initial-savings-remove {
  color: var(--text-muted);
}

.initial-savings-edit:hover,
.initial-savings-remove:hover {
  opacity: 0.8;
}

.initial-savings-note {
  resize: none;
  font-family: inherit;
}

.initial-savings-sheet-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Pedido explicito del usuario: "puede ser de alguna billetera, o de un ingreso
   futuro" - PillToggle ya usado en TransactionsFilterSheet.vue, no se inventa un
   toggle nuevo. */
.initial-savings-source-toggle {
  align-self: flex-start;
}

.initial-savings-wallet-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.initial-savings-sheet-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.initial-savings-sheet-actions :deep(.base-button) {
  width: 100%;
}

.wizard-hint,
.capacity-hint {
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--bg-inset);
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
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
