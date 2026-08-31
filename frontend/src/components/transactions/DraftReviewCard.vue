<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWalletsStore } from '../../stores/wallets.store'
import { confirmDraft, discardDraft } from '../../services/transactions/transactions.service'
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
const props = withDefaults(defineProps<{ draft: Draft; initialType?: TransactionType }>(), { initialType: 'expense' })
const emit = defineEmits<{ confirmed: [transaction: Transaction, draftId: string]; discarded: [draftId: string] }>()

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
const type = ref<TransactionType>(props.initialType)
const amount = ref<number | null>(props.draft.parsedAmount)
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

    <div class="draft-fields">
      <label class="field">
        <span class="field-label">Billetera</span>
        <select v-model="walletId" required>
          <option value="" disabled>Elige una billetera</option>
          <option v-for="wallet in walletsStore.wallets" :key="wallet.id" :value="wallet.id">
            {{ wallet.name }} ({{ wallet.currency }}) — {{ formatCurrency(wallet.balance, wallet.currency) }}
          </option>
        </select>
      </label>

      <div class="draft-fields-row">
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

      <p v-if="exceedsBalance" class="draft-balance-warning" role="alert">
        Supera el saldo de esta billetera ({{ formatCurrency(selectedWallet?.balance ?? 0, selectedWallet?.currency ?? '') }}).
      </p>

      <CategoryField v-model="category" :kind="type" />

      <label class="field">
        <span class="field-label">Descripción (opcional)</span>
        <input v-model="description" type="text" placeholder="Detalle" />
      </label>
    </div>

    <p v-if="errorMessage" class="draft-error" role="alert">{{ errorMessage }}</p>

    <div class="draft-actions">
      <BaseButton type="button" variant="secondary" size="sm" :disabled="isSubmitting" @click="onDiscard">
        Descartar
      </BaseButton>
      <BaseButton type="button" size="sm" :disabled="isSubmitting" @click="onConfirm">
        {{ isSubmitting ? 'Procesando...' : 'Confirmar' }}
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
