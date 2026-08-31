<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGoals } from '../../composables/goals/useGoals'
import type { CreateGoalInput, GoalVoicePreview } from '../../services/goals/interfaces/goals.interface'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import CreateGoalWizard from './CreateGoalWizard.vue'
import GoalVoiceEntryButton from './GoalVoiceEntryButton.vue'

// Pantalla propia "/metas/nueva" - pedido explicito del usuario: el alta de una
// meta no debe verse como un modal (BottomSheet), sino como una vista real que se
// pueda ir/volver con la misma animacion tipo pagina que ya usa el resto de la app
// (ver usePageTransition.ts: entrar a una sub-ruta mas profunda desliza para
// adelante, volver desliza para atras - no hace falta nada especial aca, el
// fallback por profundidad de path ya lo resuelve solo).
const router = useRouter()
const { savingsCapacity, isLoading, error, fetchSavingsCapacity, create } = useGoals()

const voicePreview = ref<GoalVoicePreview | null>(null)

onMounted(() => {
  fetchSavingsCapacity()
})

function goBack() {
  router.push({ name: 'metas' })
}

function onVoiceParsed(preview: GoalVoicePreview) {
  voicePreview.value = preview
}

async function onCreate(input: CreateGoalInput) {
  try {
    await create(input)
    goBack()
  } catch {
    // El mensaje ya queda expuesto via el "error" reactivo del composable -
    // no hace falta duplicar el manejo aca, solo evitar que la navegacion
    // ocurra cuando la creacion falla.
  }
}
</script>

<template>
  <PageShell>
    <SectionHeader title="Nueva meta" max-width="40rem" @back="goBack" />

    <div class="create-goal-view">
      <GoalVoiceEntryButton class="voice-entry-slot" @parsed="onVoiceParsed" />

      <p v-if="error" class="create-goal-error" role="alert">{{ error }}</p>

      <CreateGoalWizard
        :submitting="isLoading"
        :initial-title="voicePreview?.title ?? null"
        :initial-amount="voicePreview?.amount ?? null"
        :initial-amount-is-monthly="voicePreview?.amountIsMonthly ?? false"
        :initial-currency="voicePreview?.currency ?? 'USD'"
        :initial-target-date="voicePreview?.targetDate ?? null"
        :savings-capacity="savingsCapacity"
        @create="onCreate"
        @cancel="goBack"
      />
    </div>
  </PageShell>
</template>

<style scoped>
.create-goal-view {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
}

.voice-entry-slot {
  margin-bottom: 1.25rem;
}

.create-goal-error {
  margin-bottom: 1rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}
</style>
