<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useBulkCapture } from '../../composables/screenshotScan/useBulkCapture'
import type { ConfirmOutcome } from '../../composables/screenshotScan/useBulkCapture'
import { useWalletsStore } from '../../stores/wallets.store'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { SCREENSHOT_ACCEPT } from '../../utils/screenshotScan/prepareImage'
import CategoryField from '../transactions/CategoryField.vue'
import BaseButton from '../ui/BaseButton.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import PillToggle from '../ui/PillToggle.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import BulkRowCard from './BulkRowCard.vue'

// Registro desde capturas, paso a paso (misma estructura y animaciones que
// CreateGoalWizard.vue). Cada paso es una sola pregunta; los que no aplican se saltan solos:
//  - wallet: de que billetera son (se salta si se llego desde una billetera);
//  - kind: que se va a registrar (todo, gastos, ingresos, transferencias);
//  - details: dia por defecto y comisiones;
//  - expenseCategory / incomeCategory: categoria para todos los gastos / ingresos (solo si aplica);
//  - captures: subir una o varias capturas (se leen en el dispositivo);
//  - review: revisar cada fila (que es, categoria, pendiente u omitir);
//  - confirm: resumen y registro.
type StepId = 'wallet' | 'kind' | 'details' | 'expenseCategory' | 'incomeCategory' | 'captures' | 'review' | 'confirm'

const props = withDefaults(defineProps<{ initialWalletId?: string }>(), { initialWalletId: '' })
const emit = defineEmits<{ done: [outcome: ConfirmOutcome]; cancel: [] }>()

const walletsStore = useWalletsStore()
const capture = useBulkCapture(props.initialWalletId)

// Las categorias solo hacen falta donde se registran gastos o ingresos (no en transferencias).
const showExpenseCategory = computed(() => capture.scope.value === 'all' || capture.scope.value === 'expenses')
const showIncomeCategory = computed(() => capture.scope.value === 'all' || capture.scope.value === 'received')

const steps = computed<StepId[]>(() => {
  const list: StepId[] = []
  if (!props.initialWalletId) list.push('wallet')
  list.push('kind', 'details')
  if (showExpenseCategory.value) list.push('expenseCategory')
  if (showIncomeCategory.value) list.push('incomeCategory')
  list.push('captures', 'review', 'confirm')
  return list
})

const stepId = ref<StepId>(steps.value[0]!)
const stepIndex = computed(() => Math.max(0, steps.value.indexOf(stepId.value)))

const stepTransitionName = ref<'slide-left' | 'slide-right'>('slide-left')
watch(stepId, (newId, oldId) => {
  stepTransitionName.value = steps.value.indexOf(newId) > steps.value.indexOf(oldId) ? 'slide-left' : 'slide-right'
})

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const outcome = ref<ConfirmOutcome | null>(null)

const DATE_OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'custom', label: 'Otra fecha' },
]

const TRANSFER_KIND_OPTIONS = [
  { value: 'p2p', label: 'P2P de Binance' },
  { value: 'other', label: 'Otra transferencia' },
]

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Todo' },
  { value: 'expenses', label: 'Solo gastos' },
  { value: 'received', label: 'Solo ingresos' },
  { value: 'transfers', label: 'Transferencias' },
]

function goNext() {
  const next = steps.value[stepIndex.value + 1]
  if (!next) return
  // Al pasar a las capturas, lo elegido antes (billetera, categorias) queda como valor por defecto
  // de las filas que ya se hubieran leido.
  if (next === 'captures') capture.reapplyDefaults()
  stepId.value = next
}

function goBack() {
  if (stepIndex.value === 0) emit('cancel')
  else stepId.value = steps.value[stepIndex.value - 1]!
}

const todayValue = (() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})()

onMounted(() => {
  walletsStore.fetchWallets().catch(() => {})
  document.addEventListener('paste', onPaste)
})

onBeforeUnmount(() => {
  document.removeEventListener('paste', onPaste)
  capture.reset()
})

function pickFiles() {
  fileInput.value?.click()
}

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length > 0) void capture.addImages(files)
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length > 0) void capture.addImages(files)
}

// Ctrl+V en escritorio: pega una captura copiada al portapapeles (solo en los pasos
// donde se pueden agregar imagenes).
function onPaste(event: ClipboardEvent) {
  if (stepId.value !== 'captures' && stepId.value !== 'review') return
  const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'))
  if (files.length > 0) void capture.addImages(files)
}

const canContinueFromCaptures = computed(() => capture.visibleRows.value.length > 0 && !capture.isReading.value)

const hasP2pOrders = computed(() => capture.images.value.some((image) => image.kind === 'p2p_orders' && image.status === 'done'))
const hasUnlinkedReceived = computed(() =>
  capture.visibleRows.value.some((row) => row.source === 'bank' && row.direction === 'in' && row.action !== 'transfer' && row.action !== 'skip'),
)
// Sugerencia: si hay recibidos sin USDT conocidos y no se subio el historial P2P, conviene subirlo.
const suggestP2pCapture = computed(() => hasUnlinkedReceived.value && !hasP2pOrders.value)

async function onConfirm() {
  const result = await capture.confirm()
  outcome.value = result
  if (result.failures.length === 0) emit('done', result)
}

const wallet = computed(() => walletsStore.wallets.find((item) => item.id === capture.selectedWalletId.value) ?? null)
const summaryCurrency = computed(() => wallet.value?.currency ?? 'VEF')

// Explica que hace cada opcion de "Que quieres registrar". Una transferencia es dinero que se mueve
// entre las cuentas del propio usuario (por ejemplo una venta P2P de USDT por bolivares): nunca es un
// gasto ni un ingreso.
const scopeHint = computed(() => {
  switch (capture.scope.value) {
    case 'expenses':
      return 'Solo gastos: no se toma en cuenta el dinero recibido ni las transferencias (como las órdenes P2P).'
    case 'received':
      return 'Solo ingresos: no se toman en cuenta los gastos ni las transferencias (como las órdenes P2P).'
    case 'transfers':
      return 'Transferencias: dinero que mueves entre tus propias cuentas. No es un gasto ni un ingreso.'
    default:
      return 'Todo: se detecta solo qué es cada movimiento. Puedes cambiarlo al revisar.'
  }
})

// Detalle de la transferencia: P2P de Binance (se enlaza con las ordenes) u otra (por ejemplo, le diste
// dolares de Facebank a un amigo que te los cambio a USDT).
const transferKindHint = computed(() =>
  capture.transferKind.value === 'p2p'
    ? 'P2P de Binance: cada orden se registra como una transferencia entre tu billetera en USDT y la de bolívares, y los movimientos del banco quedan pendientes de enlazar con su orden (que trae los USDT).'
    : 'Otra transferencia: por ejemplo, le diste dólares de Facebank a un amigo que te los cambió a USDT. Cada movimiento se registra como una transferencia desde la billetera elegida; tú indicas a cuál billetera llegó y cuánto.',
)
</script>

<template>
  <div class="bulk-wizard">
    <div class="wizard-progress">
      <span v-for="(id, index) in steps" :key="id" class="wizard-progress-segment" :class="{ filled: index <= stepIndex }" />
    </div>

    <input
      ref="fileInput"
      type="file"
      multiple
      :accept="SCREENSHOT_ACCEPT"
      class="visually-hidden"
      @change="onFilesSelected"
    />

    <div class="wizard-steps-viewport">
      <Transition :name="stepTransitionName">
        <div v-if="stepId === 'wallet'" key="wallet" class="wizard-step">
          <h2 class="wizard-title">¿De qué billetera son?</h2>
          <p class="wizard-subtitle">Los movimientos de la captura se registrarán en ella. Puedes cambiarla por movimiento al revisar.</p>

          <div class="wallet-grid">
            <button
              v-for="item in walletsStore.wallets"
              :key="item.id"
              type="button"
              class="wallet-tile"
              :class="{ active: item.id === capture.selectedWalletId.value }"
              @click="capture.selectWallet(item.id)"
            >
              <span class="wallet-tile-name">{{ item.name }}</span>
              <span class="wallet-tile-currency">{{ item.currency }}</span>
            </button>
          </div>
          <p v-if="walletsStore.wallets.length === 0" class="wizard-hint">Primero crea una billetera en Cuentas.</p>
          <p v-else-if="capture.walletAutoSelected.value" class="wizard-hint">
            Elegimos la única billetera posible. Puedes cambiarla.
          </p>

          <BaseButton class="wizard-next" @click="goNext">Continuar</BaseButton>
        </div>

        <div v-else-if="stepId === 'kind'" key="kind" class="wizard-step">
          <button v-if="stepIndex > 0" type="button" class="wizard-back" aria-label="Atrás" @click="goBack">←</button>

          <h2 class="wizard-title">¿Qué quieres registrar?</h2>
          <p class="wizard-subtitle">Es opcional: con "Todo" se detecta solo qué es cada movimiento.</p>

          <PillToggle
            :options="SCOPE_OPTIONS"
            :model-value="capture.scope.value"
            @update:model-value="capture.scope.value = $event as 'all' | 'expenses' | 'received' | 'transfers'"
          />
          <p class="wizard-hint">{{ scopeHint }}</p>

          <template v-if="capture.scope.value === 'transfers'">
            <h3 class="wizard-section">¿Qué tipo de transferencia?</h3>
            <PillToggle
              :options="TRANSFER_KIND_OPTIONS"
              :model-value="capture.transferKind.value"
              @update:model-value="capture.transferKind.value = $event as 'p2p' | 'other'"
            />
            <p class="wizard-hint">{{ transferKindHint }}</p>
          </template>

          <BaseButton class="wizard-next" @click="goNext">Continuar</BaseButton>
        </div>

        <div v-else-if="stepId === 'details'" key="details" class="wizard-step">
          <button v-if="stepIndex > 0" type="button" class="wizard-back" aria-label="Atrás" @click="goBack">←</button>

          <h2 class="wizard-title">Fecha y comisiones</h2>
          <p class="wizard-subtitle">Dos datos que se usan cuando la captura no los trae.</p>

          <h3 class="wizard-section">¿De qué día?</h3>
          <PillToggle
            :options="DATE_OPTIONS"
            :model-value="capture.dateChoice.value"
            @update:model-value="capture.dateChoice.value = $event as 'today' | 'yesterday' | 'custom'"
          />
          <input
            v-if="capture.dateChoice.value === 'custom'"
            v-model="capture.customDate.value"
            type="date"
            class="date-input"
            :max="todayValue"
          />
          <p class="wizard-hint">Si la captura dice AYER o trae fechas, se respeta lo que dice.</p>

          <h3 class="wizard-section">Comisiones</h3>
          <ToggleSwitch v-model="capture.includeFees.value" label="Tomar en cuenta las comisiones" />
          <p class="wizard-hint">
            Las comisiones ("Cobro comisión...") se registran como un gasto aparte en la categoría Comisión. Desactívalo si no las quieres.
          </p>

          <BaseButton class="wizard-next" @click="goNext">Continuar</BaseButton>
        </div>

        <div v-else-if="stepId === 'expenseCategory'" key="expenseCategory" class="wizard-step">
          <button v-if="stepIndex > 0" type="button" class="wizard-back" aria-label="Atrás" @click="goBack">←</button>

          <h2 class="wizard-title">Categoría de los gastos</h2>
          <p class="wizard-subtitle">Opcional. Si todos son de lo mismo (por ejemplo, mercado), elígela aquí. Si no, la eliges fila por fila.</p>

          <CategoryField v-model="capture.expenseCategory.value" kind="expense" />

          <BaseButton class="wizard-next" @click="goNext">
            {{ capture.expenseCategory.value.trim() ? 'Continuar' : 'Continuar sin categoría' }}
          </BaseButton>
        </div>

        <div v-else-if="stepId === 'incomeCategory'" key="incomeCategory" class="wizard-step">
          <button v-if="stepIndex > 0" type="button" class="wizard-back" aria-label="Atrás" @click="goBack">←</button>

          <h2 class="wizard-title">Categoría de los ingresos</h2>
          <p class="wizard-subtitle">Opcional. Si todos son de lo mismo, elígela aquí. Si no, la eliges fila por fila.</p>

          <CategoryField v-model="capture.incomeCategory.value" kind="income" />

          <BaseButton class="wizard-next" @click="goNext">
            {{ capture.incomeCategory.value.trim() ? 'Continuar' : 'Continuar sin categoría' }}
          </BaseButton>
        </div>

        <div v-else-if="stepId === 'captures'" key="captures" class="wizard-step">
          <button type="button" class="wizard-back" aria-label="Atrás" @click="goBack">←</button>

          <h2 class="wizard-title">Sube tus capturas</h2>
          <p class="wizard-subtitle">Puede ser la lista de movimientos o el estado de cuenta de tu banco, el historial de órdenes P2P de Binance o un comprobante.</p>

          <div
            class="dropzone"
            :class="{ 'dropzone--active': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave="isDragging = false"
            @drop.prevent="onDrop"
          >
            <p class="dropzone-hint dropzone-hint--desktop">Arrastra las capturas aquí o pégalas con Ctrl+V.</p>
            <BaseButton type="button" size="sm" @click="pickFiles">Elegir capturas</BaseButton>
            <p class="dropzone-hint">Se leen en tu dispositivo: las imágenes no se suben.</p>
          </div>

          <div class="tip">
            <strong>Consejo:</strong> si recibiste bolívares por vender USDT, sube también la captura del historial de órdenes P2P de
            Binance. Así sabemos cuántos USDT fueron y la transferencia queda completa.
          </div>

          <ul v-if="capture.images.value.length > 0" class="image-list">
            <li v-for="image in capture.images.value" :key="image.id" class="image-item" :class="`image-item--${image.status}`">
              <img v-if="image.url" :src="image.url" alt="" class="image-thumb" />
              <div class="image-info">
                <p class="image-name">{{ image.name }}</p>
                <p v-if="image.status === 'reading'" class="image-status">Leyendo la captura...</p>
                <p v-else-if="image.status === 'done'" class="image-status">{{ image.message }} · {{ image.rowCount }} {{ image.rowCount === 1 ? 'movimiento' : 'movimientos' }}</p>
                <p v-else class="image-status image-status--error" role="alert">{{ image.message }}</p>
              </div>
              <button type="button" class="image-remove" aria-label="Quitar captura" @click="capture.removeImage(image.id)">×</button>
            </li>
          </ul>
          <LoadingIndicator v-if="capture.isReading.value" label="Leyendo..." />

          <BaseButton class="wizard-next" :disabled="!canContinueFromCaptures" @click="goNext">Continuar</BaseButton>
        </div>

        <div v-else-if="stepId === 'review'" key="review" class="wizard-step">
          <button type="button" class="wizard-back" aria-label="Atrás" @click="goBack">←</button>

          <h2 class="wizard-title">Revisa los movimientos</h2>
          <p class="wizard-subtitle">
            {{ capture.visibleRows.value.length }} {{ capture.visibleRows.value.length === 1 ? 'movimiento' : 'movimientos' }}
            <template v-if="capture.blockedRows.value.length > 0"> · {{ capture.blockedRows.value.length }} por completar</template>
          </p>

          <div v-if="suggestP2pCapture" class="tip">
            Hay dinero recibido sin saber cuántos USDT fue. Sube el historial de órdenes P2P de Binance para completarlo, o déjalo
            como pendiente.
            <button type="button" class="tip-action" @click="pickFiles">Subir captura de Binance</button>
          </div>

          <div class="row-list">
            <BulkRowCard
              v-for="row in capture.visibleRows.value"
              :key="row.id"
              :row="row"
              :issues="capture.issuesByRow.value.get(row.id) ?? []"
              :wallets="walletsStore.wallets"
              @update="capture.updateRow(row.id, $event)"
            />
          </div>

          <button type="button" class="link-action" @click="pickFiles">+ Agregar otra captura</button>
          <LoadingIndicator v-if="capture.isReading.value" label="Leyendo..." />

          <p v-if="capture.blockedRows.value.length > 0" class="wizard-hint">
            Completa las filas marcadas, déjalas como pendientes u omítelas para continuar.
          </p>
          <BaseButton class="wizard-next" :disabled="!capture.canConfirm.value || capture.isReading.value" @click="goNext">
            Continuar
          </BaseButton>
        </div>

        <div v-else-if="stepId === 'confirm'" key="confirm" class="wizard-step">
          <button type="button" class="wizard-back" aria-label="Atrás" :disabled="capture.isConfirming.value" @click="goBack">←</button>

          <h2 class="wizard-title">Confirma el registro</h2>
          <p class="wizard-subtitle">Revisa el resumen antes de guardar.</p>

          <ul class="summary-list">
            <li v-if="capture.summary.value.expenses > 0">
              <span>{{ capture.summary.value.expenses }} {{ capture.summary.value.expenses === 1 ? 'gasto' : 'gastos' }}</span>
              <strong>{{ formatCurrency(capture.summary.value.expensesTotal, summaryCurrency) }}</strong>
            </li>
            <li v-if="capture.summary.value.incomes > 0">
              <span>{{ capture.summary.value.incomes }} {{ capture.summary.value.incomes === 1 ? 'recibido' : 'recibidos' }}</span>
              <strong>{{ formatCurrency(capture.summary.value.incomesTotal, summaryCurrency) }}</strong>
            </li>
            <li v-if="capture.summary.value.transfers > 0">
              <span>{{ capture.summary.value.transfers }} {{ capture.summary.value.transfers === 1 ? 'transferencia' : 'transferencias' }}</span>
            </li>
            <li v-if="capture.summary.value.pendings > 0">
              <span>{{ capture.summary.value.pendings }} {{ capture.summary.value.pendings === 1 ? 'pendiente' : 'pendientes' }} (los completas después)</span>
            </li>
            <li v-if="capture.summary.value.skipped > 0">
              <span>{{ capture.summary.value.skipped }} {{ capture.summary.value.skipped === 1 ? 'omitido' : 'omitidos' }} (no se registran)</span>
            </li>
            <li v-if="capture.summary.value.duplicates > 0">
              <span>{{ capture.summary.value.duplicates }} ya {{ capture.summary.value.duplicates === 1 ? 'estaba registrado' : 'estaban registrados' }} (por eso se omiten)</span>
            </li>
          </ul>

          <div v-if="outcome && outcome.failures.length > 0" class="failure-box" role="alert">
            <p class="failure-title">Algunos movimientos no se pudieron registrar:</p>
            <ul>
              <li v-for="failure in outcome.failures" :key="failure.label + failure.message">
                <strong>{{ failure.label }}:</strong> {{ failure.message }}
              </li>
            </ul>
            <p class="failure-hint">Lo que sí se registró ya no aparece en la lista. Corrige lo pendiente y vuelve a intentarlo.</p>
          </div>

          <BaseButton class="wizard-next" :disabled="!capture.canConfirm.value" @click="onConfirm">
            {{ capture.isConfirming.value ? 'Registrando...' : 'Registrar' }}
          </BaseButton>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.bulk-wizard {
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

/* Mismo contrato que .route-transition-viewport en style.css: los pasos entrante y
   saliente son position:absolute durante la transicion de slide. */
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

.wizard-section {
  margin-top: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-h);
}

.wizard-hint {
  font-size: 0.75rem;
  line-height: 1.4;
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
}

.wizard-back:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.wallet-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
}

.wallet-tile {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.75rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  color: var(--text-h);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.wallet-tile:active {
  transform: scale(0.97);
}

.wallet-tile.active {
  border-color: var(--accent);
  background: var(--accent-muted);
}

.wallet-tile-name {
  font-size: 0.9375rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.wallet-tile-currency {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.category-block {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.category-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.date-input {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.625rem;
  padding: 1.25rem 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.dropzone--active {
  border-color: var(--accent);
  background: var(--accent-muted);
}

.dropzone-hint {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

/* Arrastrar y pegar no aplican en pantallas tactiles. */
@media (hover: none) {
  .dropzone-hint--desktop {
    display: none;
  }
}

.tip {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--text-muted);
}

.tip strong {
  color: var(--text-h);
}

.tip-action,
.link-action {
  display: block;
  margin-top: 0.375rem;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}

.image-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.image-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.image-item--error {
  border-color: var(--accent-border);
}

.image-thumb {
  width: 2.5rem;
  height: 3.5rem;
  border-radius: 0.25rem;
  object-fit: cover;
}

.image-info {
  flex: 1;
  min-width: 0;
}

.image-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-status {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.image-status--error {
  color: var(--accent);
}

.image-remove {
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 1.25rem;
  cursor: pointer;
}

.row-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.summary-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  color: var(--text-h);
}

.failure-box {
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.failure-box ul {
  margin: 0.375rem 0;
  padding-left: 1rem;
}

.failure-title {
  font-weight: 700;
}

.failure-hint {
  color: var(--text-muted);
}
</style>
