<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWalletsStore } from '../../stores/wallets.store'
import { confirmDraft, confirmDraftAsTransfer, discardDraft } from '../../services/transactions/transactions.service'
import type { Draft, Transaction, TransactionType } from '../../services/transactions/interfaces/transactions.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import CategoryField from './CategoryField.vue'

// Revision de un draft pendiente (viene de voz/OCR - esa captura todavia no
// existe, ver plan de Berry, pero el flujo de revision si esta completo).
// Los campos parsed_* del backend son solo una sugerencia editable: el
// usuario elige la billetera y confirma/corrige monto y categoria antes de
// que se cree la transaction real (el backend exige wallet_id/type/
// final_amount/final_category explicitos en el confirm, ver
// transactions.service.ts).
// initialType: igual criterio que TransactionForm.vue - quien monta esto ya
// puede saber que tipo espera (ej. un draft capturado desde el sheet de
// Ingresos/Gastos de Inicio, ver IncomeExpenseSummary.vue). El selector
// sigue editable, esto solo define con que arranca.
//
// Un pendiente del registro desde capturas (source "screenshot") llega con tipo, fecha
// y comision ya guardados. Si es dinero recibido cuyo origen se ignoraba (ej. Bs de una
// venta de USDT), se puede completar como transferencia indicando cuanto salio del
// origen: el monto del borrador es lo que llego al destino.
const props = withDefaults(defineProps<{ draft: Draft; initialType?: TransactionType }>(), { initialType: 'expense' })
const emit = defineEmits<{
  confirmed: [transaction: Transaction, draftId: string]
  transferred: [draftId: string]
  discarded: [draftId: string]
}>()

const walletsStore = useWalletsStore()

// Bug real corregido: el selector de billetera nunca arrancaba preseleccionado. Orden
// de preferencia: 1) draft.suggestedWalletId, si el backend ya identifico una wallet
// puntual por nombre (ver full_balance_detector.py - "gasté todo lo que tenía en mi
// cuenta de Binance"), señal mas fuerte que la moneda sola; 2) si la moneda parseada
// matchea la moneda de exactamente UNA wallet del usuario, esa; 3) en cualquier otro
// caso (moneda ambigua, o ninguna coincide) se deja vacío para que el usuario elija.
function initialWalletId(): string {
  if (props.draft.suggestedWalletId && walletsStore.wallets.some((wallet) => wallet.id === props.draft.suggestedWalletId)) {
    return props.draft.suggestedWalletId
  }
  const matchingWallet = walletsStore.wallets.filter((wallet) => wallet.currency === props.draft.parsedCurrency)
  return matchingWallet.length === 1 ? matchingWallet[0].id : ''
}

const walletId = ref(initialWalletId())
const type = ref<TransactionType>(props.draft.txnType ?? props.initialType)
const amount = ref<number | null>(props.draft.parsedAmount)

// Completar como transferencia (solo pendientes de capturas): la billetera elegida
// arriba es la que RECIBIO el dinero, y aqui se indica de cual salio y cuanto.
const isScreenshotDraft = props.draft.source === 'screenshot'
const asTransfer = ref(false)
const fromWalletId = ref('')
const sentAmount = ref<number | null>(null)
const transferFee = ref<number | null>(props.draft.fee)
const canTransfer = computed(
  () =>
    walletId.value !== '' &&
    fromWalletId.value !== '' &&
    fromWalletId.value !== walletId.value &&
    (sentAmount.value ?? 0) > 0,
)

const draftDate = computed(() => (props.draft.occurredAt ? props.draft.occurredAt.slice(0, 10) : null))
const category = ref(props.draft.parsedCategory ?? '')
const description = ref(props.draft.parsedDescription ?? '')
const isSubmitting = ref(false)
const errorMessage = ref('')

const selectedWallet = computed(() => walletsStore.wallets.find((wallet) => wallet.id === walletId.value) ?? null)

// "Usé todo lo que tenía" en un click, en vez de tener que copiar el numero a mano -
// pedido explicito del usuario, mismo criterio en TransactionForm.vue.
function useMaxAmount() {
  if (selectedWallet.value) amount.value = selectedWallet.value.balance
}

// Aviso, nunca bloqueante (el backend tampoco valida saldo en una transaction manual,
// solo en transferencias) - el usuario puede seguir igual, solo se le avisa.
const exceedsBalance = computed(
  () => type.value === 'expense' && selectedWallet.value !== null && (amount.value ?? 0) > selectedWallet.value.balance,
)

async function onConfirm() {
  if (!walletId.value || !category.value.trim() || (amount.value ?? 0) <= 0) return

  errorMessage.value = ''
  isSubmitting.value = true
  try {
    const transaction = await confirmDraft(props.draft.id, {
      walletId: walletId.value,
      type: type.value,
      finalAmount: amount.value as number,
      finalCategory: category.value.trim(),
      finalDescription: description.value.trim() || undefined,
      occurredAt: props.draft.occurredAt ?? undefined,
      fee: props.draft.fee ?? undefined,
    })
    // Va el draft.id explicito ademas de la transaction creada - son ids de
    // entidades distintas (tablas separadas backend-side), asi que quien
    // escucha este evento no puede sacar el draft de su lista comparando
    // contra transaction.id (bug real: la tarjeta de revision nunca
    // desaparecia despues de confirmar, porque ese id nunca coincidia).
    emit('confirmed', transaction, props.draft.id)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo confirmar el borrador.'
  } finally {
    isSubmitting.value = false
  }
}

async function onConfirmTransfer() {
  if (!canTransfer.value) return

  errorMessage.value = ''
  isSubmitting.value = true
  try {
    await confirmDraftAsTransfer(props.draft.id, {
      fromWalletId: fromWalletId.value,
      toWalletId: walletId.value,
      sentAmount: sentAmount.value as number,
      fee: transferFee.value ?? undefined,
      occurredAt: props.draft.occurredAt ?? undefined,
    })
    emit('transferred', props.draft.id)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo completar la transferencia.'
  } finally {
    isSubmitting.value = false
  }
}

async function onDiscard() {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    await discardDraft(props.draft.id)
    emit('discarded', props.draft.id)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo descartar el borrador.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <BaseCard class="draft-card">
    <p class="draft-source">Borrador vía {{ draft.source }}</p>
    <p v-if="draft.rawInput" class="draft-raw-input">"{{ draft.rawInput }}"</p>
    <p v-if="draftDate || draft.reference" class="draft-meta">
      <span v-if="draftDate">{{ draftDate }}</span>
      <span v-if="draft.reference"> · Ref. {{ draft.reference }}</span>
    </p>

    <div v-if="isScreenshotDraft && type === 'income'" class="draft-mode" role="tablist">
      <button type="button" class="draft-mode-chip" :class="{ active: !asTransfer }" role="tab" :aria-selected="!asTransfer" @click="asTransfer = false">
        Registrar como ingreso
      </button>
      <button type="button" class="draft-mode-chip" :class="{ active: asTransfer }" role="tab" :aria-selected="asTransfer" @click="asTransfer = true">
        Completar como transferencia
      </button>
    </div>

    <div class="draft-fields">
      <label class="field">
        <span class="field-label">{{ asTransfer ? 'Billetera que recibió' : 'Billetera' }}</span>
        <select v-model="walletId" required>
          <option value="" disabled>Elige una billetera</option>
          <option v-for="wallet in walletsStore.wallets" :key="wallet.id" :value="wallet.id">
            {{ wallet.name }} ({{ wallet.currency }}) — {{ formatCurrency(wallet.balance, wallet.currency) }}
          </option>
        </select>
      </label>

      <template v-if="asTransfer">
        <label class="field">
          <span class="field-label">Desde qué billetera salió</span>
          <select v-model="fromWalletId">
            <option value="" disabled>Elige una billetera</option>
            <option v-for="wallet in walletsStore.wallets" :key="wallet.id" :value="wallet.id">
              {{ wallet.name }} ({{ wallet.currency }}) — {{ formatCurrency(wallet.balance, wallet.currency) }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Cuánto salió del origen</span>
          <input v-model.number="sentAmount" type="number" min="0.01" step="0.01" placeholder="Por ejemplo, los USDT" />
        </label>
        <label class="field">
          <span class="field-label">Comisión (opcional)</span>
          <input v-model.number="transferFee" type="number" min="0" step="0.01" placeholder="0.00" />
        </label>
      </template>

      <div v-else class="draft-fields-row">
        <label class="field">
          <span class="field-label">Tipo</span>
          <select v-model="type">
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Monto{{ draft.parsedCurrency ? ` (${draft.parsedCurrency})` : '' }}</span>
          <div class="amount-input-row">
            <input v-model.number="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
            <button v-if="selectedWallet" type="button" class="max-amount-trigger" @click="useMaxAmount">Max</button>
          </div>
        </label>
      </div>

      <template v-if="!asTransfer">
        <p v-if="exceedsBalance" class="draft-balance-warning" role="alert">
          Supera el saldo de esta billetera ({{ formatCurrency(selectedWallet?.balance ?? 0, selectedWallet?.currency ?? '') }}).
        </p>

        <CategoryField v-model="category" :kind="type" />

        <label class="field">
          <span class="field-label">Descripción (opcional)</span>
          <input v-model="description" type="text" placeholder="Detalle" />
        </label>
      </template>
    </div>

    <p v-if="errorMessage" class="draft-error" role="alert">{{ errorMessage }}</p>

    <div class="draft-actions">
      <BaseButton type="button" variant="secondary" size="sm" :disabled="isSubmitting" @click="onDiscard">
        Descartar
      </BaseButton>
      <BaseButton
        type="button"
        size="sm"
        :disabled="isSubmitting || (asTransfer && !canTransfer)"
        @click="asTransfer ? onConfirmTransfer() : onConfirm()"
      >
        {{ isSubmitting ? 'Procesando...' : asTransfer ? 'Completar transferencia' : 'Confirmar' }}
      </BaseButton>
    </div>
  </BaseCard>
</template>

<style scoped>
.draft-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.draft-source {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: capitalize;
}

.draft-raw-input {
  font-size: 0.8125rem;
  color: var(--text);
  font-style: italic;
}

.draft-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.draft-mode {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.draft-mode-chip {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}

.draft-mode-chip.active {
  background: var(--accent-muted);
  border-color: var(--accent-border);
  color: var(--accent);
  font-weight: 600;
}

.draft-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.draft-fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
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
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--accent);
}

.amount-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.amount-input-row input {
  flex: 1;
  min-width: 0;
}

.max-amount-trigger {
  flex-shrink: 0;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--glass-border);
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.max-amount-trigger:hover {
  opacity: 0.85;
}

.draft-balance-warning {
  margin-top: -0.375rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.draft-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.draft-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
