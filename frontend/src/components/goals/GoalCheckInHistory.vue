<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listCheckIns, updateCheckIn } from '../../services/goals/goals.service'
import type { GoalCheckIn, UpdateCheckInInput } from '../../services/goals/interfaces/goals.interface'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { formatDate } from '../../utils/formatters/formatDate'
import BottomSheet from '../ui/BottomSheet.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import GoalCheckInEditSheet from './GoalCheckInEditSheet.vue'

// Historial de check-ins de UNA meta - carga perezosa (solo al abrir el
// detalle de una meta puntual, ver GoalsMain.vue), no se trae junto con la
// lista general de metas: sin esto, todo el trabajo de registrar
// postergaciones quedaria invisible para el usuario.
const props = withDefaults(
  defineProps<{ goalId: string; currency: string; wallets?: Wallet[]; walletCommitments?: Record<string, number> }>(),
  { wallets: () => [], walletCommitments: () => ({}) },
)

// Editar un aporte cambia cuanto queda "comprometido" en la billetera vieja/nueva -
// pedido implicito: el mapa walletCommitments que recibimos por prop se vuelve stale
// hasta que el ancestro (GoalsMain.vue) lo vuelva a pedir. Se avisa hacia arriba en
// vez de duplicar ese fetch aca (este componente no tiene acceso a useGoals()).
const emit = defineEmits<{ checkInEdited: [] }>()

const checkIns = ref<GoalCheckIn[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    checkIns.value = await listCheckIns(props.goalId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo obtener el historial.'
  } finally {
    isLoading.value = false
  }
})

function walletName(walletId: string | null): string | null {
  if (walletId === null) return null
  return props.wallets.find((wallet) => wallet.id === walletId)?.name ?? null
}

// Editar un aporte - pedido explicito del usuario: reenlazar uno que quedo
// como "ingreso futuro" una vez que esa plata efectivamente llego. Solo
// billetera/nota, nunca monto ni fecha (ver GoalCheckInEditSheet.vue).
const editingCheckIn = ref<GoalCheckIn | null>(null)
const editError = ref<string | null>(null)

function openEdit(checkIn: GoalCheckIn) {
  editError.value = null
  editingCheckIn.value = checkIn
}

async function onSaveEdit(input: UpdateCheckInInput) {
  if (!editingCheckIn.value) return
  try {
    const updated = await updateCheckIn(props.goalId, editingCheckIn.value.id, input)
    checkIns.value = checkIns.value.map((c) => (c.id === updated.id ? updated : c))
    editingCheckIn.value = null
    emit('checkInEdited')
  } catch (err) {
    editError.value = err instanceof Error ? err.message : 'No se pudo editar el aporte.'
  }
}
</script>

<template>
  <div class="check-in-history">
    <Transition name="loading-fade" mode="out-in">
      <LoadingIndicator v-if="isLoading" key="loading" label="Cargando historial..." />
      <p v-else-if="error" key="error" class="check-in-history-status error">{{ error }}</p>
      <p v-else-if="checkIns.length === 0" key="empty" class="check-in-history-status">
        Todavía no hay aportes registrados.
      </p>

      <ul v-else key="list" class="check-in-history-list">
        <li v-for="checkIn in checkIns" :key="checkIn.id" class="check-in-history-item">
          <div class="check-in-history-row">
            <span class="check-in-history-date">{{ formatDate(checkIn.createdAt) }}</span>
            <span class="check-in-history-amount">{{ formatCurrency(checkIn.amountSaved, currency) }}</span>
          </div>
          <p v-if="checkIn.newTargetDate" class="check-in-history-postponed">
            Meta pospuesta a {{ formatDate(checkIn.newTargetDate) }}
            <span v-if="checkIn.note">— {{ checkIn.note }}</span>
          </p>
          <!-- De donde salio este aporte - pedido explicito del usuario. Solo se
               muestra la nota aca cuando NO es la de posponer (ya se muestra arriba)
               - un check-in "ingreso futuro" sin postergacion no tenia donde mostrar
               su nota antes de esto. -->
          <div class="check-in-history-source-row">
            <p class="check-in-history-source">
              {{ walletName(checkIn.walletId) ? `Desde: ${walletName(checkIn.walletId)}` : 'Ingreso futuro' }}
              <span v-if="checkIn.walletId === null && checkIn.note && !checkIn.newTargetDate">— {{ checkIn.note }}</span>
            </p>
            <button type="button" class="check-in-history-edit" @click="openEdit(checkIn)">Editar</button>
          </div>
        </li>
      </ul>
    </Transition>

    <p v-if="editError" class="check-in-history-status error">{{ editError }}</p>

    <!-- <Teleport to="body">: mismo motivo que en GoalCard.vue/CreateGoalWizard.vue -
         escapa el contexto de apilamiento que crea backdrop-filter en un ancestro. -->
    <Teleport to="body">
      <BottomSheet v-if="editingCheckIn" title="Editar aporte" @close="editingCheckIn = null">
        <GoalCheckInEditSheet
          :check-in="editingCheckIn"
          :goal-currency="currency"
          :wallets="wallets"
          :wallet-commitments="walletCommitments"
          @save="onSaveEdit"
          @cancel="editingCheckIn = null"
        />
      </BottomSheet>
    </Teleport>
  </div>
</template>

<style scoped>
.check-in-history-status {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.check-in-history-status.error {
  color: var(--accent);
}

.check-in-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.check-in-history-item {
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--bg-inset);
}

.check-in-history-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.check-in-history-date {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.check-in-history-amount {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-h);
}

.check-in-history-postponed {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--accent);
  line-height: 1.4;
}

.check-in-history-source-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

.check-in-history-source {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.check-in-history-edit {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.check-in-history-edit:hover {
  opacity: 0.8;
}
</style>
