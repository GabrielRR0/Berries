<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useBulkCapture } from '../../composables/screenshotScan/useBulkCapture'
import type { ConfirmOutcome } from '../../composables/screenshotScan/useBulkCapture'
import { useWalletsStore } from '../../stores/wallets.store'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { SCREENSHOT_ACCEPT } from '../../utils/screenshotScan/prepareImage'
import BaseButton from '../ui/BaseButton.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import PillToggle from '../ui/PillToggle.vue'
import BulkRowCard from './BulkRowCard.vue'

// Registro desde capturas, paso a paso (misma estructura y animaciones que
// CreateGoalWizard.vue):
//  1. Billetera y fecha por defecto.
//  2. Subir una o varias capturas (lista del banco, historial P2P de Binance o un
//     comprobante suelto): se leen en el dispositivo.
//  3. Revisar cada fila: que es (gasto, recibido, transferencia), categoria, o dejarla
//     pendiente / omitirla.
//  4. Confirmar: resumen y registro.
const props = withDefaults(defineProps<{ initialWalletId?: string }>(), { initialWalletId: '' })
const emit = defineEmits<{ done: [outcome: ConfirmOutcome]; cancel: [] }>()

const walletsStore = useWalletsStore()
const capture = useBulkCapture(props.initialWalletId)

const step = ref<1 | 2 | 3 | 4>(1)
const stepTransitionName = ref<'slide-left' | 'slide-right'>('slide-left')
watch(step, (newStep, oldStep) => {
  stepTransitionName.value = newStep > oldStep ? 'slide-left' : 'slide-right'
})

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const outcome = ref<ConfirmOutcome | null>(null)

const DATE_OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'custom', label: 'Otra fecha' },
]

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

function goBack() {
  if (step.value === 1) emit('cancel')
  else step.value = (step.value - 1) as 1 | 2 | 3 | 4
}

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
  if (step.value !== 2 && step.value !== 3) return
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
</script>

<template>
  <div class="bulk-wizard">
    <div class="wizard-progress">
      <span v-for="n in 4" :key="n" class="wizard-progress-segment" :class="{ filled: n <= step }" />
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
        <div v-if="step === 1" key="1" class="wizard-step">
          <h2 class="wizard-title">¿De qué billetera son?</h2>
          <p class="wizard-subtitle">Los movimientos de la captura se registrarán en esta billetera. Puedes cambiarla por movimiento.</p>

          <div class="wallet-grid">
            <button
              v-for="item in walletsStore.wallets"
              :key="item.id"
              type="button"
              class="wallet-tile"
              :class="{ active: item.id === capture.selectedWalletId.value }"
              @click="capture.selectedWalletId.value = item.id"
            >
              <span class="wallet-tile-name">{{ item.name }}</span>
              <span class="wallet-tile-currency">{{ item.currency }}</span>
            </button>
          </div>
          <p v-if="walletsStore.wallets.length === 0" class="wizard-hint">Primero crea una billetera en Cuentas.</p>

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
          <p class="wizard-hint">Se usa cuando la captura no trae el día. Si dice AYER o trae fechas, se respeta lo que dice.</p>

          <BaseButton class="wizard-next" @click="step = 2">Continuar</BaseButton>
        </div>

        <div v-else-if="step === 2" key="2" class="wizard-step">
          <button type="button" class="wizard-back" aria-label="Atrás" @click="goBack">←</button>

          <h2 class="wizard-title">Sube tus capturas</h2>
          <p class="wizard-subtitle">Puede ser la lista de movimientos de tu banco, el historial de órdenes P2P de Binance o un comprobante.</p>

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

          <BaseButton class="wizard-next" :disabled="!canContinueFromCaptures" @click="step = 3">Continuar</BaseButton>
        </div>

        <div v-else-if="step === 3" key="3" class="wizard-step">
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
          <BaseButton class="wizard-next" :disabled="!capture.canConfirm.value || capture.isReading.value" @click="step = 4">
            Continuar
          </BaseButton>
        </div>

        <div v-else key="4" class="wizard-step">
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
