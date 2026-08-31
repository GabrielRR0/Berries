<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWalletsStore } from '../../stores/wallets.store'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'

// Transferencia entre dos wallets propias. El "monto convertido" solo se
// pide cuando from/to tienen moneda distinta: todavia no hay conversion
// automatica wireada aca (queda para una pasada futura, ver plan de Berry) -
// por ahora el usuario lo llena a mano y el backend valida que venga si
// hace falta (400 si falta, ver wallets.service.ts/TransferParams).
const emit = defineEmits<{ transferred: []; cancel: [] }>()

const walletsStore = useWalletsStore()

const fromWalletId = ref('')
const toWalletId = ref('')
const amount = ref<number | null>(null)
const fee = ref<number | null>(null)
const convertedAmount = ref<number | null>(null)
const submitting = ref(false)
const errorMessage = ref('')

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
    await walletsStore.transfer({
      fromWalletId: fromWalletId.value,
      toWalletId: toWalletId.value,
      amount: amount.value,
      fee: fee.value ?? undefined,
      convertedAmount: needsConvertedAmount.value ? (convertedAmount.value ?? undefined) : undefined,
    })
    emit('transferred')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo completar la transferencia.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseCard class="transfer-form">
    <h2 class="form-title">Transferir entre billeteras</h2>

    <form class="form-body" @submit.prevent="onSubmit">
      <label class="field">
        <span class="field-label">Desde</span>
        <select v-model="fromWalletId" required>
          <option value="" disabled>Elige una billetera</option>
          <option v-for="wallet in walletsStore.wallets" :key="wallet.id" :value="wallet.id">
            {{ wallet.name }} ({{ wallet.currency }})
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">Hacia</span>
        <select v-model="toWalletId" required>
          <option value="" disabled>Elige una billetera</option>
          <option v-for="wallet in walletsStore.wallets" :key="wallet.id" :value="wallet.id">
            {{ wallet.name }} ({{ wallet.currency }})
          </option>
        </select>
      </label>

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

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

      <div class="form-actions">
        <BaseButton type="button" variant="secondary" size="sm" :disabled="submitting" @click="$emit('cancel')">
          Cancelar
        </BaseButton>
        <BaseButton type="submit" size="sm" :disabled="submitting || !canSubmit">
          {{ submitting ? 'Transfiriendo...' : 'Transferir' }}
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
