<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWalletsStore } from '../../stores/wallets.store'
import { createTransaction, updateTransaction } from '../../services/transactions/transactions.service'
import type { Transaction, TransactionType } from '../../services/transactions/interfaces/transactions.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import CategoryField from './CategoryField.vue'

// Registro manual de un movimiento. Transactions no tiene un Pinia store
// propio (a diferencia de wallets) - es estado local por pantalla, asi que
// este form llama directo al service y emite la transaction creada/editada para
// que TransactionsMain.vue la agregue/actualice en su lista local sin re-pedir todo.
// initialType: quien monta el form ya puede saber que tipo quiere (ej. la
// box de "Ingresos"/"Gastos" en Inicio, ver IncomeExpenseSummary.vue) - el
// toggle sigue editable, esto solo define con que arranca seleccionado.
//
// editingTransaction: pedido explicito del usuario ("se debe poder editar los
// movimientos... montos, fecha de pago, description, wallet_id, category") - el MISMO
// form sirve para crear y editar (todos los campos ya existen), solo cambia con que
// valores arranca precargado y a que endpoint manda el submit. null/undefined = modo
// creacion (comportamiento de siempre).
const props = withDefaults(
  defineProps<{ initialType?: TransactionType; editingTransaction?: Transaction | null }>(),
  { initialType: 'expense', editingTransaction: null },
)
const emit = defineEmits<{ created: [transaction: Transaction]; updated: [transaction: Transaction]; cancel: [] }>()

const walletsStore = useWalletsStore()
const isEditing = computed(() => props.editingTransaction != null)

const walletId = ref(props.editingTransaction?.walletId ?? '')
const type = ref<TransactionType>(props.editingTransaction?.type ?? props.initialType)
const amount = ref<number | null>(props.editingTransaction?.amount ?? null)
const category = ref(props.editingTransaction?.category ?? '')
const description = ref(props.editingTransaction?.description ?? '')
const submitting = ref(false)
const errorMessage = ref('')

// Fecha del movimiento - pedido explicito del usuario ("ayer olvidé registrar un
// gasto... no me sale ningún input para la fecha"): antes este form no tenia forma de
// elegir la fecha (siempre quedaba "ahora"), aunque createTransaction() YA aceptaba un
// occurredAt opcional (usado desde tests/otros flujos) - solo faltaba el input. Arranca
// en HOY (formato YYYY-MM-DD en hora LOCAL, no UTC - un toISOString().slice(0,10)
// corriente puede quedar en el dia anterior/siguiente cerca de medianoche segun el
// huso horario). max=hoy: no tiene sentido registrar un movimiento "del futuro" (ni
// siquiera editando uno viejo).
function todayInputValue(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Editando: arranca en la fecha PROPIA del movimiento (en LOCAL, mismo criterio que
// todayInputValue - un toISOString().slice(0,10) crudo puede correrse un dia segun el
// huso horario), no en "hoy".
function localDateInputValue(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayValue = todayInputValue()
const occurredAtDate = ref(props.editingTransaction ? localDateInputValue(props.editingTransaction.occurredAt) : todayValue)

// Combina la fecha elegida con la hora ACTUAL (no medianoche ni mediodia fijo) - si el
// usuario no toca el campo (se queda en "hoy"), esto da el mismo resultado que no mandar
// occurredAt en absoluto (el backend igual default-ea a "ahora").
function buildOccurredAt(): string {
  const [year, month, day] = occurredAtDate.value.split('-').map(Number)
  const now = new Date()
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString()
}

function openDatePicker(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  input.showPicker?.()
}

const selectedWallet = computed(() => walletsStore.wallets.find((wallet) => wallet.id === walletId.value) ?? null)

// "Usé todo lo que tenía" en un click - pedido explicito del usuario, mismo criterio
// en DraftReviewCard.vue.
function useMaxAmount() {
  if (selectedWallet.value) amount.value = selectedWallet.value.balance
}

// Aviso, nunca bloqueante (el backend tampoco valida saldo en una transaction manual,
// solo en transferencias) - el usuario puede seguir igual, solo se le avisa.
const exceedsBalance = computed(
  () => type.value === 'expense' && selectedWallet.value !== null && (amount.value ?? 0) > selectedWallet.value.balance,
)

async function onSubmit() {
  if (!walletId.value || !category.value.trim() || (amount.value ?? 0) <= 0) return

  errorMessage.value = ''
  submitting.value = true
  try {
    const fields = {
      walletId: walletId.value,
      type: type.value,
      amount: amount.value as number,
      category: category.value.trim(),
      description: description.value.trim() || undefined,
      occurredAt: buildOccurredAt(),
    }
    if (props.editingTransaction) {
      const transaction = await updateTransaction(props.editingTransaction.id, fields)
      emit('updated', transaction)
    } else {
      const transaction = await createTransaction(fields)
      emit('created', transaction)
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : props.editingTransaction
          ? 'No se pudo editar el movimiento.'
          : 'No se pudo registrar el movimiento.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseCard class="transaction-form">
    <h2 class="form-title">{{ isEditing ? 'Editar movimiento' : 'Nuevo movimiento' }}</h2>

    <form class="form-body" @submit.prevent="onSubmit">
      <div class="type-toggle" role="tablist">
        <button
          type="button"
          class="type-option"
          role="tab"
          :aria-selected="type === 'expense'"
          :class="{ active: type === 'expense' }"
          @click="type = 'expense'"
        >
          Gasto
        </button>
        <button
          type="button"
          class="type-option"
          role="tab"
          :aria-selected="type === 'income'"
          :class="{ active: type === 'income' }"
          @click="type = 'income'"
        >
          Ingreso
        </button>
      </div>

      <label class="field">
        <span class="field-label">Billetera</span>
        <select v-model="walletId" required>
          <option value="" disabled>Elige una billetera</option>
          <option v-for="wallet in walletsStore.wallets" :key="wallet.id" :value="wallet.id">
            {{ wallet.name }} ({{ wallet.currency }}) — {{ formatCurrency(wallet.balance, wallet.currency) }}
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">Monto</span>
        <div class="amount-input-row">
          <input v-model.number="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
          <button v-if="selectedWallet" type="button" class="max-amount-trigger" @click="useMaxAmount">Max</button>
        </div>
      </label>

      <p v-if="exceedsBalance" class="balance-warning" role="alert">
        Supera el saldo de esta billetera ({{ formatCurrency(selectedWallet?.balance ?? 0, selectedWallet?.currency ?? '') }}).
      </p>

      <label class="field">
        <span class="field-label">Fecha</span>
        <input v-model="occurredAtDate" type="date" :max="todayValue" required @click="openDatePicker" />
      </label>

      <CategoryField v-model="category" :kind="type" />

      <label class="field">
        <span class="field-label">Descripción (opcional)</span>
        <input v-model="description" type="text" placeholder="Detalle del movimiento" />
      </label>

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

      <div class="form-actions">
        <BaseButton type="button" variant="secondary" size="sm" :disabled="submitting" @click="$emit('cancel')">
          Cancelar
        </BaseButton>
        <BaseButton type="submit" size="sm" :disabled="submitting">
          {{ submitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Guardar' }}
        </BaseButton>
      </div>
    </form>
  </BaseCard>
</template>

<style scoped>
.transaction-form {
  animation: form-enter var(--duration-base) var(--ease-out) both;
}

.form-title {
  font-size: 1rem;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.type-toggle {
  display: inline-flex;
  align-self: flex-start;
  gap: 0.375rem;
  padding: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: 1px solid var(--glass-border);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .type-toggle {
    background: var(--bg-inset);
  }
}

.type-option {
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.type-option:hover {
  color: var(--text-h);
}

.type-option:active {
  transform: scale(0.94);
}

.type-option.active {
  background: var(--accent);
  color: var(--accent-contrast);
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

.balance-warning {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.form-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@keyframes form-enter {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
