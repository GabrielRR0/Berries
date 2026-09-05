<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GoalCheckIn, UpdateCheckInInput } from '../../services/goals/interfaces/goals.interface'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { currenciesAreEquivalent } from '../../utils/currency/currencyEquivalence'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { availableBalance } from '../../utils/wallets/availableBalance'
import BaseButton from '../ui/BaseButton.vue'
import PillToggle from '../ui/PillToggle.vue'

// Contenido del sheet de edicion de UN aporte ya existente - pedido explicito
// del usuario: "yo quiero ir a metas y en ese aporte editarlo y decir que los
// voy a usar de mi billetera [una vez que ese ingreso futuro ya llego]". Solo
// billetera/nota - nunca monto ni fecha (mismo criterio que
// GoalCheckInUpdateRequest del backend). Contenido nada mas (sin su propio
// Teleport/BottomSheet) - mismo patron que TransferForm.vue, el padre
// (GoalCheckInHistory.vue) es quien lo envuelve en el sheet.
const props = defineProps<{
  checkIn: GoalCheckIn
  goalCurrency: string
  wallets: Wallet[]
  walletCommitments: Record<string, number>
}>()

const emit = defineEmits<{ save: [input: UpdateCheckInInput]; cancel: [] }>()

const sourceType = ref<'wallet' | 'future'>(props.checkIn.walletId !== null ? 'wallet' : 'future')
const walletId = ref<string | null>(props.checkIn.walletId)
const note = ref(props.checkIn.note ?? '')

// Solo billeteras de la MISMA moneda que la meta (o el par USD/USDT, atado
// 1:1 - pedido explicito del usuario).
const walletsForCheckIn = computed(() =>
  props.wallets.filter((wallet) => currenciesAreEquivalent(wallet.currency, props.goalCurrency)),
)

// Si la billetera elegida es la MISMA a la que este aporte ya estaba enlazado,
// su propio monto no debe contar como "ya comprometido" contra si mismo -
// mismo criterio que exclude_check_in_id en wallet_commitment_service.py del
// backend (sin esto, reconfirmar la misma billetera se rechazaria sola).
function availableForThisCheckIn(wallet: Wallet): number {
  const raw = availableBalance(wallet, props.walletCommitments)
  return wallet.id === props.checkIn.walletId ? raw + props.checkIn.amountSaved : raw
}

const selectedWalletAvailable = computed(() => {
  const wallet = walletsForCheckIn.value.find((w) => w.id === walletId.value)
  return wallet ? availableForThisCheckIn(wallet) : null
})

const canSave = computed(() => {
  if (sourceType.value !== 'wallet') return true
  if (walletId.value === null) return false
  return selectedWalletAvailable.value !== null && props.checkIn.amountSaved <= selectedWalletAvailable.value
})

function onSave() {
  if (!canSave.value) return
  emit('save', {
    walletId: sourceType.value === 'wallet' ? walletId.value : null,
    // La nota es la explicacion de "por que ingreso futuro" - una vez enlazada una
    // billetera real, ya no aplica (se limpia en vez de arrastrar la vieja).
    note: sourceType.value === 'future' ? note.value.trim() || null : null,
  })
}
</script>

<template>
  <div class="check-in-edit-sheet">
    <p class="check-in-edit-amount">{{ formatCurrency(checkIn.amountSaved, goalCurrency) }}</p>

    <PillToggle
      :options="[
        { value: 'wallet', label: 'Billetera' },
        { value: 'future', label: 'Ingreso futuro' },
      ]"
      v-model="sourceType"
      class="check-in-edit-source-toggle"
    />

    <div v-if="sourceType === 'wallet'" class="check-in-edit-wallet-field">
      <select v-model="walletId">
        <option :value="null" disabled>Elige una billetera</option>
        <option v-for="wallet in walletsForCheckIn" :key="wallet.id" :value="wallet.id">
          {{ wallet.name }} — disponible {{ formatCurrency(availableForThisCheckIn(wallet), wallet.currency) }}
        </option>
      </select>
      <p v-if="walletsForCheckIn.length === 0" class="check-in-edit-hint">
        No tienes billeteras en {{ goalCurrency }} todavía.
      </p>
      <p v-else-if="walletId !== null && !canSave" class="check-in-edit-hint warning">
        Esa billetera no tiene disponible suficiente para este monto.
      </p>
    </div>
    <input v-else v-model="note" type="text" maxlength="500" placeholder="¿De dónde sale? (opcional)" />

    <div class="check-in-edit-actions">
      <BaseButton type="button" variant="secondary" size="sm" @click="emit('cancel')">Cancelar</BaseButton>
      <BaseButton type="button" size="sm" :disabled="!canSave" @click="onSave">Guardar cambios</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.check-in-edit-sheet {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.check-in-edit-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-h);
}

.check-in-edit-source-toggle {
  align-self: flex-start;
}

.check-in-edit-wallet-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.check-in-edit-wallet-field select,
.check-in-edit-sheet input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
}

.check-in-edit-wallet-field select:focus,
.check-in-edit-sheet input:focus {
  outline: none;
  border-color: var(--accent);
}

.check-in-edit-hint {
  padding: 0.4375rem 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--bg-inset);
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
}

.check-in-edit-hint.warning {
  border-color: var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
}

.check-in-edit-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.check-in-edit-actions :deep(.base-button) {
  width: 100%;
}
</style>
