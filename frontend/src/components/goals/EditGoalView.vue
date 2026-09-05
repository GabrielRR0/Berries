<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGoals } from '../../composables/goals/useGoals'
import { getGoal, getWalletCommitments } from '../../services/goals/goals.service'
import type { Goal, UpdateGoalInput } from '../../services/goals/interfaces/goals.interface'
import { useWalletsStore } from '../../stores/wallets.store'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import BaseCard from '../ui/BaseCard.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import EditGoalForm from './EditGoalForm.vue'
import GoalCheckInHistory from './GoalCheckInHistory.vue'

// Pantalla propia "/metas/:id/editar" - mismo criterio que CreateGoalView.vue
// (pedido explicito del usuario: nada de modales para esto). A diferencia de
// cuando editar vivia en un BottomSheet dentro de GoalsMain.vue (que ya tenia la
// meta cargada en memoria), esta es una ruta real - puede llegarse por refresh
// directo de la URL, asi que la meta se pide fresca por id, no se asume que ya
// este en ningun lado.
const route = useRoute()
const router = useRouter()
const { savingsCapacity, isLoading, error, fetchSavingsCapacity, update } = useGoals()

const goal = ref<Goal | null>(null)
const isFetching = ref(true)
const loadError = ref<string | null>(null)

// Pedido explicito del usuario: "cuando le doy a editar meta debe salir la
// opcion de editar aporte" - GoalCheckInHistory.vue ya tiene esa edicion (ver
// GoalCheckInEditSheet.vue), esta pantalla solo necesita billeteras/
// comprometido para poder mostrarla, mismo criterio self-contained que
// CreateGoalWizard.vue (no comparte instancia de useGoals() con GoalsMain.vue).
const walletsStore = useWalletsStore()
const walletCommitments = ref<Record<string, number>>({})

async function fetchWalletCommitments() {
  try {
    const commitments = await getWalletCommitments()
    walletCommitments.value = Object.fromEntries(commitments.map((c) => [c.walletId, c.committedAmount]))
  } catch {
    // Best-effort: si falla, el historial simplemente no muestra "disponible"
    // en el selector de billetera al editar un aporte.
  }
}

function goalId(): string {
  return route.params.id as string
}

onMounted(async () => {
  fetchSavingsCapacity()
  walletsStore.fetchWallets()
  fetchWalletCommitments()
  try {
    goal.value = await getGoal(goalId())
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'No se pudo obtener la meta.'
  } finally {
    isFetching.value = false
  }
})

function goBack() {
  router.push({ name: 'metas' })
}

async function onSubmit(input: UpdateGoalInput) {
  try {
    await update(goalId(), input)
    goBack()
  } catch {
    // El mensaje ya queda expuesto via el "error" reactivo del composable.
  }
}
</script>

<template>
  <PageShell hide-tab-bar>
    <SectionHeader title="Editar meta" max-width="40rem" @back="goBack" />

    <div class="edit-goal-view">
      <Transition name="loading-fade" mode="out-in">
        <LoadingIndicator v-if="isFetching" key="loading" label="Cargando meta..." />

        <p v-else-if="loadError" key="load-error" class="edit-goal-error" role="alert">{{ loadError }}</p>

        <div v-else-if="goal" key="form">
          <p v-if="error" class="edit-goal-error" role="alert">{{ error }}</p>
          <EditGoalForm :goal="goal" :submitting="isLoading" :savings-capacity="savingsCapacity" @submit="onSubmit" @cancel="goBack" />

          <section class="edit-goal-contributions">
            <h2 class="edit-goal-contributions-title">Aportes registrados</h2>
            <GoalCheckInHistory
              :goal-id="goal.id"
              :currency="goal.currency"
              :wallets="walletsStore.wallets"
              :wallet-commitments="walletCommitments"
              @check-in-edited="fetchWalletCommitments"
            />
          </section>
        </div>

        <BaseCard v-else key="not-found" class="edit-goal-not-found">
          <p>No se encontró la meta.</p>
        </BaseCard>
      </Transition>
    </div>
  </PageShell>
</template>

<style scoped>
.edit-goal-view {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
}

.edit-goal-error {
  margin-bottom: 1rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.edit-goal-not-found {
  text-align: center;
  color: var(--text-muted);
}

.edit-goal-contributions {
  margin-top: 1.5rem;
}

.edit-goal-contributions-title {
  margin-bottom: 0.75rem;
  font-size: 1rem;
}
</style>
