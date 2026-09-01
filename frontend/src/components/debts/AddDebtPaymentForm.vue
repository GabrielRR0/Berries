<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWalletsStore } from '../../stores/wallets.store'
import type { CreateDebtPaymentInput, Debt, DebtPaymentVoicePreview } from '../../services/debts/interfaces/debts.interface'
import { SUPPORTED_CURRENCIES } from '../../utils/currency/supportedCurrencies'
import BaseButton from '../ui/BaseButton.vue'
import DebtPaymentVoiceButton from './DebtPaymentVoiceButton.vue'

// Formulario de "Registrar pago" (abono/cobro parcial) de una deuda - pedido
// explicito del usuario: "Steven me debe 500 y me paga 50 usdt, poder
// agregarlo y descontarlo de la deuda". A diferencia de las cuotas (monto
// fijo definido al crear la deuda), esto acepta cualquier monto en cualquier
// momento.
//
// "Aplicado a la deuda" solo se pide cuando la moneda del pago difiere de la
// moneda de la deuda (mismo criterio que TransferForm.vue/convertedAmount:
// sin conversion automatica por tasas en vivo, lo escribe el usuario a mano) -
// EXCEPTO el par USD/USDT, atado 1:1 (pedido explicito del usuario: "100$
// equivale siempre a 100 usdt y viceversa"), donde nunca se pide (el backend
// tambien lo resuelve solo, ver debt_payment_service.py - esto es solo para
// no mostrar el campo en la UI).
//
// "Acreditar/debitar una billetera" es opcional: si el usuario elige una,
// ademas de quedar en el historial el pago se refleja como un
// ingreso/gasto real en esa billetera - "seria como un ingreso de una deuda"
// (pedido explicito). Solo se ofrecen billeteras en la MISMA moneda que el
// pago (se deposita/retira exactamente lo que paso, sin convertir).
const props = withDefaults(defineProps<{ debt: Debt; submitting?: boolean }>(), { submitting: false })
const emit = defineEmits<{ create: [input: CreateDebtPaymentInput]; cancel: [] }>()

const walletsStore = useWalletsStore()

const amount = ref('')
const currency = ref(props.debt.currency)
const appliedAmount = ref('')
const note = ref('')
const paidAt = ref(new Date().toISOString().slice(0, 10))
const walletId = ref('')

const USD_PEGGED_CURRENCIES = new Set(['USD', 'USDT'])
const needsAppliedAmount = computed(() => {
  if (currency.value === props.debt.currency) return false
  return !(USD_PEGGED_CURRENCIES.has(currency.value) && USD_PEGGED_CURRENCIES.has(props.debt.currency))
})

const matchingWallets = computed(() => walletsStore.wallets.filter((wallet) => wallet.currency === currency.value))

// Si la billetera elegida deja de matchear la moneda del pago (el usuario
// cambio la moneda despues de elegirla), se limpia - evita mandar un
// wallet_id que ya no corresponde sin que el usuario lo note.
watch(currency, () => {
  if (walletId.value && !matchingWallets.value.some((wallet) => wallet.id === walletId.value)) {
    walletId.value = ''
  }
})

function onVoiceParsed(preview: DebtPaymentVoicePreview) {
  if (preview.amount !== null) amount.value = String(preview.amount)
  currency.value = preview.currency
  paidAt.value = preview.paidAt
  if (preview.note) note.value = preview.note
}

const canSubmit = computed(
  () =>
    !props.submitting &&
    (Number(amount.value) || 0) > 0 &&
    (!needsAppliedAmount.value || (Number(appliedAmount.value) || 0) > 0),
)

function onSubmit() {
  if (!canSubmit.value) return

  const input: CreateDebtPaymentInput = {
    amount: Number(amount.value),
    currency: currency.value,
  }
  if (needsAppliedAmount.value) input.appliedAmount = Number(appliedAmount.value)
  if (note.value.trim()) input.note = note.value.trim()
  if (paidAt.value) input.paidAt = paidAt.value
  if (walletId.value) input.walletId = walletId.value

  emit('create', input)
}
</script>

<template>
  <form class="add-payment-form" @submit.prevent="onSubmit">
    <DebtPaymentVoiceButton :debt-id="debt.id" @parsed="onVoiceParsed" />

    <div class="field-row">
      <label class="field">
        <span class="field-label">Monto</span>
        <input v-model="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
      </label>

      <label class="field">
        <span class="field-label">Moneda</span>
        <select v-model="currency">
          <option v-for="option in SUPPORTED_CURRENCIES" :key="option.code" :value="option.code">
            {{ option.code }}
          </option>
        </select>
      </label>
    </div>

    <label v-if="needsAppliedAmount" class="field">
      <span class="field-label">Equivalente aplicado a la deuda ({{ debt.currency }})</span>
      <input v-model="appliedAmount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
    </label>

    <label v-if="matchingWallets.length > 0" class="field">
      <span class="field-label">Acreditar en billetera (opcional)</span>
      <select v-model="walletId">
        <option value="">No acreditar ninguna billetera</option>
        <option v-for="wallet in matchingWallets" :key="wallet.id" :value="wallet.id">{{ wallet.name }}</option>
      </select>
    </label>

    <label class="field">
      <span class="field-label">Fecha</span>
      <input v-model="paidAt" type="date" required />
    </label>

    <label class="field">
      <span class="field-label">Nota (opcional)</span>
      <input v-model="note" type="text" maxlength="280" placeholder="Ej. Transferencia por Zelle" />
    </label>

    <div class="form-actions">
      <BaseButton type="button" variant="secondary" :disabled="submitting" @click="emit('cancel')">
        Cancelar
      </BaseButton>
      <BaseButton type="submit" :disabled="!canSubmit">
        {{ submitting ? 'Guardando...' : 'Registrar pago' }}
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.add-payment-form {
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
