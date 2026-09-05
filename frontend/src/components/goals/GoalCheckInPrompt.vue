<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PendingCheckIn, RecordCheckInInput } from '../../services/goals/interfaces/goals.interface'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { currenciesAreEquivalent } from '../../utils/currency/currencyEquivalence'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { availableBalance } from '../../utils/wallets/availableBalance'
import BaseCard from '../ui/BaseCard.vue'
import PillToggle from '../ui/PillToggle.vue'

// Card de chequeo mensual pendiente (usada por GoalsMain.vue) - pregunta si
// se reunio el aporte de este mes para una meta puntual, pedido explicito
// del usuario. Tarjeta dismissible, no un modal bloqueante (Berry no tiene
// modales forzados en ningun lado). Dos acciones: registrar el aporte tal
// cual, o posponer (revela fecha nueva + nota opcional).
const props = withDefaults(
  defineProps<{ pending: PendingCheckIn; wallets?: Wallet[]; walletCommitments?: Record<string, number> }>(),
  { wallets: () => [], walletCommitments: () => ({}) },
)

const emit = defineEmits<{ submit: [input: RecordCheckInInput] }>()

const amount = ref(props.pending.suggestedAmount.toString())
const showPostpone = ref(false)
const newTargetDate = ref('')
const note = ref('')

// De donde sale este aporte - pedido explicito del usuario, visible tanto al
// registrar normal como al posponer (posponer tambien registra un monto, ver
// submitPostpone). Solo billeteras de la MISMA moneda que la meta.
const sourceType = ref<'wallet' | 'future'>('future')
const walletId = ref<string | null>(null)
// Nota de "de donde sale" - SOLO se usa en el registro normal (no posponiendo):
// posponer ya tiene su propia nota de "por que se poospuso" (el ref `note` de
// arriba), y un check-in solo tiene una columna de nota en el backend.
const contributionNote = ref('')

// Solo billeteras de la MISMA moneda que la meta (o el par USD/USDT, atado 1:1 -
// pedido explicito del usuario).
const walletsForCheckIn = computed(() =>
  props.wallets.filter((wallet) => currenciesAreEquivalent(wallet.currency, props.pending.currency)),
)

const selectedWalletAvailable = computed(() => {
  const wallet = walletsForCheckIn.value.find((w) => w.id === walletId.value)
  return wallet ? availableBalance(wallet, props.walletCommitments) : null
})

const canSubmitAmount = computed(() => {
  const value = Number(amount.value)
  if (!Number.isFinite(value) || value <= 0) return true // 0 es valido ("no ahorre nada este mes")
  if (sourceType.value !== 'wallet') return true
  if (walletId.value === null) return false
  return selectedWalletAvailable.value !== null && value <= selectedWalletAvailable.value
})

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const currentMonthLabel = MESES[new Date().getMonth()]

function submitRegular() {
  if (!canSubmitAmount.value) return
  const value = Number(amount.value)
  emit('submit', {
    amountSaved: Number.isFinite(value) && value > 0 ? value : 0,
    walletId: sourceType.value === 'wallet' ? (walletId.value ?? undefined) : undefined,
    note: sourceType.value === 'future' ? contributionNote.value.trim() || undefined : undefined,
  })
}

function submitPostpone() {
  if (!newTargetDate.value || !canSubmitAmount.value) return
  const value = Number(amount.value)
  emit('submit', {
    amountSaved: Number.isFinite(value) && value > 0 ? value : 0,
    newTargetDate: newTargetDate.value,
    note: note.value.trim() || undefined,
    walletId: sourceType.value === 'wallet' ? (walletId.value ?? undefined) : undefined,
  })
}
</script>

<template>
  <BaseCard class="check-in-prompt">
    <p class="check-in-question">
      ¿Reuniste tu aporte de {{ currentMonthLabel }} para "{{ pending.title }}"?
    </p>

    <label class="check-in-amount-field">
      <span class="check-in-amount-label">Monto reunido este mes</span>
      <input v-model="amount" type="number" min="0" step="0.01" inputmode="decimal" />
      <span class="check-in-suggested">
        Sugerido: {{ formatCurrency(pending.suggestedAmount, pending.currency) }}
      </span>
    </label>

    <!-- De donde sale este aporte - pedido explicito del usuario, visible tanto
         al registrar normal como al posponer. -->
    <PillToggle
      :options="[
        { value: 'wallet', label: 'Billetera' },
        { value: 'future', label: 'Ingreso futuro' },
      ]"
      v-model="sourceType"
      class="check-in-source-toggle"
    />

    <div v-if="sourceType === 'wallet'" class="check-in-wallet-field">
      <select v-model="walletId">
        <option :value="null" disabled>Elige una billetera</option>
        <option v-for="wallet in walletsForCheckIn" :key="wallet.id" :value="wallet.id">
          {{ wallet.name }} — disponible {{ formatCurrency(availableBalance(wallet, walletCommitments), wallet.currency) }}
        </option>
      </select>
      <p v-if="walletsForCheckIn.length === 0" class="check-in-wallet-hint">
        No tienes billeteras en {{ pending.currency }} todavía.
      </p>
      <p v-else-if="walletId !== null && !canSubmitAmount" class="check-in-wallet-hint warning">
        Esa billetera no tiene disponible suficiente para este monto.
      </p>
    </div>

    <input
      v-if="!showPostpone && sourceType === 'future'"
      v-model="contributionNote"
      type="text"
      class="check-in-source-note"
      placeholder="¿De dónde sale? (opcional)"
    />

    <div v-if="!showPostpone" class="check-in-actions">
      <button type="button" class="check-in-register" :disabled="!canSubmitAmount" @click="submitRegular">
        Registrar
      </button>
      <button type="button" class="check-in-postpone-trigger" @click="showPostpone = true">Posponer</button>
    </div>

    <div v-else class="check-in-postpone-form">
      <label class="check-in-postpone-field">
        <span class="check-in-amount-label">Nueva fecha objetivo</span>
        <input v-model="newTargetDate" type="date" />
      </label>
      <label class="check-in-postpone-field">
        <span class="check-in-amount-label">Nota (opcional)</span>
        <input v-model="note" type="text" placeholder="¿Qué pasó este mes?" />
      </label>
      <div class="check-in-actions">
        <button type="button" class="check-in-register" :disabled="!canSubmitAmount" @click="submitPostpone">
          Confirmar postergación
        </button>
        <button type="button" class="check-in-postpone-trigger" @click="showPostpone = false">Volver</button>
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.check-in-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.check-in-question {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
  line-height: 1.4;
}

.check-in-amount-field,
.check-in-postpone-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.check-in-amount-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

.check-in-amount-field input,
.check-in-postpone-field input {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.check-in-amount-field input:focus,
.check-in-postpone-field input:focus {
  outline: none;
  border-color: var(--accent);
}

.check-in-suggested {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.check-in-source-toggle {
  align-self: flex-start;
}

.check-in-wallet-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.check-in-wallet-field select,
.check-in-source-note {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.check-in-wallet-field select:focus,
.check-in-source-note:focus {
  outline: none;
  border-color: var(--accent);
}

.check-in-wallet-hint {
  padding: 0.4375rem 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--bg-inset);
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
}

.check-in-wallet-hint.warning {
  border-color: var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
}

.check-in-postpone-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.check-in-actions {
  display: flex;
  gap: 0.625rem;
}

.check-in-register {
  flex: 1;
  padding: 0.625rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-contrast);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.check-in-postpone-trigger {
  flex: 1;
  padding: 0.625rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  color: var(--text-h);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.check-in-register:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.check-in-register:not(:disabled):hover,
.check-in-postpone-trigger:hover {
  opacity: 0.9;
}
</style>
