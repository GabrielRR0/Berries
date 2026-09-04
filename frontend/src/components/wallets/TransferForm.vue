<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TransferEditTarget } from '../../services/wallets/interfaces/wallets.interface'
import { useWalletsStore } from '../../stores/wallets.store'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'

// Transferencia entre dos wallets propias. El "monto convertido" solo se
// pide cuando from/to tienen moneda distinta: todavia no hay conversion
// automatica wireada aca (queda para una pasada futura, ver plan de Berry) -
// por ahora el usuario lo llena a mano y el backend valida que venga si
// hace falta (400 si falta, ver wallets.service.ts/TransferParams).
//
// editingTransfer: pedido explicito del usuario ("que se pueda editar esto
// [la fecha] y también los montos") - el MISMO form sirve para crear y
// editar. A diferencia de TransactionForm.vue, editar NO permite cambiar las
// billeteras origen/destino (los selects quedan deshabilitados, precargados)
// - eso sigue requiriendo eliminar y recrear la transferencia, ver
// update_transfer en el backend. El tipo vive en wallets.interface.ts (no
// aca) porque TransactionList.vue tambien lo necesita para armarlo.
const props = withDefaults(defineProps<{ editingTransfer?: TransferEditTarget | null }>(), {
  editingTransfer: null,
})
const emit = defineEmits<{ transferred: []; updated: []; cancel: [] }>()
const isEditing = computed(() => props.editingTransfer != null)

const walletsStore = useWalletsStore()

const fromWalletId = ref(props.editingTransfer?.fromWalletId ?? '')
const toWalletId = ref(props.editingTransfer?.toWalletId ?? '')
const amount = ref<number | null>(props.editingTransfer?.amount ?? null)
const fee = ref<number | null>(props.editingTransfer?.fee || null)
const convertedAmount = ref<number | null>(props.editingTransfer?.convertedAmount ?? null)
const submitting = ref(false)
const errorMessage = ref('')

// Fecha - mismo criterio que TransactionForm.vue (formato YYYY-MM-DD en hora
// LOCAL, max=hoy, combinar con la hora actual al enviar).
function todayInputValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function localDateInputValue(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const todayValue = todayInputValue()
const occurredAtDate = ref(props.editingTransfer ? localDateInputValue(props.editingTransfer.occurredAt) : todayValue)

function buildOccurredAt(): string {
  const [year, month, day] = occurredAtDate.value.split('-').map(Number)
  const now = new Date()
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString()
}

function openDatePicker(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  input.showPicker?.()
}

const fromWallet = computed(() => walletsStore.wallets.find((wallet) => wallet.id === fromWalletId.value) ?? null)
const toWallet = computed(() => walletsStore.wallets.find((wallet) => wallet.id === toWalletId.value) ?? null)

const needsConvertedAmount = computed(
  () => fromWallet.value !== null && toWallet.value !== null && fromWallet.value.currency !== toWallet.value.currency,
)

const canSubmit = computed(
  () =>
    fromWalletId.value !== '' &&
    toWalletId.value !== '' &&
    fromWalletId.value !== toWalletId.value &&
    (amount.value ?? 0) > 0 &&
    (!needsConvertedAmount.value || (convertedAmount.value ?? 0) > 0),
)

async function onSubmit() {
  if (!canSubmit.value || amount.value === null) return

  errorMessage.value = ''
  submitting.value = true
  try {
    if (props.editingTransfer) {
      await walletsStore.updateTransfer(props.editingTransfer.transferId, {
        amount: amount.value,
        occurredAt: buildOccurredAt(),
        fee: fee.value ?? undefined,
        convertedAmount: needsConvertedAmount.value ? (convertedAmount.value ?? undefined) : undefined,
      })
      emit('updated')
    } else {
      await walletsStore.transfer({
        fromWalletId: fromWalletId.value,
        toWalletId: toWalletId.value,
        amount: amount.value,
        fee: fee.value ?? undefined,
        convertedAmount: needsConvertedAmount.value ? (convertedAmount.value ?? undefined) : undefined,
        occurredAt: buildOccurredAt(),
      })
      emit('transferred')
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : props.editingTransfer
          ? 'No se pudo editar la transferencia.'
          : 'No se pudo completar la transferencia.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseCard class="transfer-form">
    <h2 class="form-title">{{ isEditing ? 'Editar transferencia' : 'Transferir entre billeteras' }}</h2>

    <form class="form-body" @submit.prevent="onSubmit">
      <label class="field">
        <span class="field-label">Desde</span>
        <select v-model="fromWalletId" required :disabled="isEditing">
          <option value="" disabled>Elige una billetera</option>
          <option v-for="wallet in walletsStore.wallets" :key="wallet.id" :value="wallet.id">
            {{ wallet.name }} ({{ wallet.currency }})
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">Hacia</span>
        <select v-model="toWalletId" required :disabled="isEditing">
          <option value="" disabled>Elige una billetera</option>
          <option v-for="wallet in walletsStore.wallets" :key="wallet.id" :value="wallet.id">
            {{ wallet.name }} ({{ wallet.currency }})
          </option>
        </select>
      </label>

      <!-- Editar no permite cambiar las billeteras (ver update_transfer en el
           backend) - se aclara para que el select deshabilitado de arriba no
           se sienta como un bug. -->
      <p v-if="isEditing" class="field-hint">
        Para mover esta transferencia a otras billeteras, eliminala y creala de nuevo.
      </p>

      <label class="field">
        <span class="field-label">Monto</span>
        <input v-model.number="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
      </label>

      <label class="field">
        <span class="field-label">Comisión (opcional)</span>
        <input v-model.number="fee" type="number" min="0" step="0.01" placeholder="0.00" />
      </label>

      <label v-if="needsConvertedAmount" class="field">
        <span class="field-label">Monto convertido ({{ toWallet?.currency }})</span>
        <input v-model.number="convertedAmount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
        <span class="field-hint">
          {{ fromWallet?.currency }} y {{ toWallet?.currency }} son monedas distintas - todavía no hay conversión
          automática, ingresa cuánto llega en {{ toWallet?.currency }}.
        </span>
      </label>

      <label class="field">
        <span class="field-label">Fecha</span>
        <input v-model="occurredAtDate" type="date" :max="todayValue" required @click="openDatePicker" />
      </label>

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

      <div class="form-actions">
        <BaseButton type="button" variant="secondary" size="sm" :disabled="submitting" @click="$emit('cancel')">
          Cancelar
        </BaseButton>
        <BaseButton type="submit" size="sm" :disabled="submitting || !canSubmit">
          {{ submitting ? (isEditing ? 'Guardando...' : 'Transfiriendo...') : isEditing ? 'Guardar cambios' : 'Transferir' }}
        </BaseButton>
      </div>
    </form>
  </BaseCard>
</template>

<style scoped>
.transfer-form {
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

.field select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
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
