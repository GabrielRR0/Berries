<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGoals } from '../../composables/goals/useGoals'
import { getGoal } from '../../services/goals/goals.service'
import type { Goal, UpdateGoalInput } from '../../services/goals/interfaces/goals.interface'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import BaseCard from '../ui/BaseCard.vue'
import EditGoalForm from './EditGoalForm.vue'

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

function goalId(): string {
  return route.params.id as string
}

onMounted(async () => {
  fetchSavingsCapacity()
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
      <p v-if="isFetching" class="edit-goal-loading">Cargando meta...</p>
      <p v-else-if="loadError" class="edit-goal-error" role="alert">{{ loadError }}</p>

      <template v-else-if="goal">
        <p v-if="error" class="edit-goal-error" role="alert">{{ error }}</p>
        <EditGoalForm :goal="goal" :submitting="isLoading" :savings-capacity="savingsCapacity" @submit="onSubmit" @cancel="goBack" />
      </template>

      <BaseCard v-else class="edit-goal-not-found">
        <p>No se encontró la meta.</p>
      </BaseCard>
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

.edit-goal-loading {
  font-size: 0.8125rem;
  color: var(--text-muted);
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
</style>
