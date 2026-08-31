<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGoals } from '../../composables/goals/useGoals'
import type { GoalStatus, RecordCheckInInput } from '../../services/goals/interfaces/goals.interface'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import PillToggle from '../ui/PillToggle.vue'
import GoalCard from './GoalCard.vue'
import GoalCheckInPrompt from './GoalCheckInPrompt.vue'

// Pantalla "Metas" (/metas) - ahorro con objetivo, pedido explicito del
// usuario ("quiero comprar un TV de aqui a tres meses, debo reunir 80$ al
// mes"), con posposicion registrada como historial visible y chequeo
// mensual dentro de la app (sin push/cron, ver check_in_service.py). El
// alta/edicion NO son un BottomSheet aca (a diferencia del resto de la app) -
// pedido explicito del usuario: "no quiero que aparezca en una modal sino que
// sea una propia vista, que se pueda retroceder y avanzar con animacion tipo
// page" - ver /metas/nueva (CreateGoalView.vue) y /metas/:id/editar
// (EditGoalView.vue), rutas reales que usan el mismo sistema de transiciones
// que cualquier otra navegacion (usePageTransition.ts).
type FilterValue = GoalStatus | 'all'

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'active', label: 'Activas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'abandoned', label: 'Abandonadas' },
]

const router = useRouter()
const {
  goals,
  summary,
  pendingCheckIns,
  savingsCapacity,
  isLoading,
  error,
  fetchGoals,
  fetchSummary,
  fetchPendingCheckIns,
  fetchSavingsCapacity,
  remove,
  checkIn,
  abandon,
} = useGoals()

const activeFilter = ref<FilterValue>('active')
const showHelpSheet = ref(false)

function goBack() {
  router.push({ name: 'dashboard' })
}

function statusParam(filter: FilterValue): GoalStatus | undefined {
  return filter === 'all' ? undefined : filter
}

async function onFilterChange(value: string) {
  const filter = value as FilterValue
  activeFilter.value = filter
  await fetchGoals(statusParam(filter))
}

function goToCreate() {
  router.push({ name: 'metas-nueva' })
}

function goToEdit(goalId: string) {
  router.push({ name: 'metas-editar', params: { id: goalId } })
}

async function onRemove(goalId: string) {
  await remove(goalId).catch(() => {})
}

async function onAbandon(goalId: string) {
  await abandon(goalId).catch(() => {})
}

async function onAddContribution(goalId: string, amount: number) {
  await checkIn(goalId, { amountSaved: amount }).catch(() => {})
}

async function onCheckInSubmit(goalId: string, input: RecordCheckInInput) {
  await checkIn(goalId, input).catch(() => {})
}

const hasGoals = computed(() => goals.value.length > 0)

onMounted(() => {
  fetchGoals(statusParam(activeFilter.value))
  fetchSummary()
  fetchPendingCheckIns()
  fetchSavingsCapacity()
})
</script>

<template>
  <PageShell>
    <SectionHeader title="Metas" max-width="68rem" @back="goBack" @help="showHelpSheet = true" />

    <div class="goals-screen">
      <div class="summary-grid">
        <BaseCard class="summary-card">
          <p class="summary-label">Reunido</p>
          <p class="summary-amount">
            <AnimatedCurrency :value="summary?.totalSaved ?? 0" currency="USD" direction="up" />
          </p>
        </BaseCard>

        <BaseCard class="summary-card">
          <p class="summary-label">Meta total</p>
          <p class="summary-amount">
            <AnimatedCurrency :value="summary?.totalTarget ?? 0" currency="USD" direction="up" />
          </p>
        </BaseCard>
      </div>

      <div v-if="pendingCheckIns.length > 0" class="pending-section">
        <h2 class="section-title">Chequeos pendientes</h2>
        <div class="pending-list">
          <GoalCheckInPrompt
            v-for="pending in pendingCheckIns"
            :key="pending.goalId"
            :pending="pending"
            @submit="onCheckInSubmit(pending.goalId, $event)"
          />
        </div>
      </div>

      <div class="goals-toolbar">
        <PillToggle :options="FILTER_OPTIONS" :model-value="activeFilter" @update:model-value="onFilterChange" />

        <button type="button" class="add-goal-button" aria-label="Agregar meta" @click="goToCreate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <p v-if="error" class="goals-error" role="alert">{{ error }}</p>
      <p v-if="isLoading" class="goals-loading">Cargando metas...</p>

      <TransitionGroup
        v-if="hasGoals"
        tag="div"
        name="goal-item"
        class="goals-list"
        appear
        appear-active-class="goal-item-appear-active"
      >
        <GoalCard
          v-for="goal in goals"
          :key="goal.id"
          :goal="goal"
          :savings-capacity="savingsCapacity"
          @remove="onRemove(goal.id)"
          @add-contribution="onAddContribution(goal.id, $event)"
          @abandon="onAbandon(goal.id)"
          @edit="goToEdit(goal.id)"
        />
      </TransitionGroup>

      <BaseCard v-else-if="!isLoading" class="goals-empty">
        <p class="goals-empty-title">Aún no tienes metas de ahorro</p>
        <p class="goals-empty-text">Usa el botón "+" para crear la primera.</p>
      </BaseCard>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Metas?" @close="showHelpSheet = false">
      <p class="help-text">
        Aquí planeas una compra con fecha ("quiero comprar un TV en 3 meses") y Berries calcula cuánto tienes que reunir
        por mes. Cada mes te preguntamos si lo lograste o si prefieres posponer la fecha - posponer queda registrado
        en el historial de la meta, no se pierde ni se esconde. También puedes agregar un aporte suelto cuando
        quieras, sin esperar al chequeo mensual.
      </p>
    </BottomSheet>
  </PageShell>
</template>

<style scoped>
.goals-screen {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.summary-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.summary-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-h);
}

.pending-section {
  margin-top: 1.5rem;
}

.section-title {
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.goals-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.add-goal-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-contrast);
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.add-goal-button svg {
  width: 1.125rem;
  height: 1.125rem;
}

.add-goal-button:hover {
  opacity: 0.9;
}

.add-goal-button:active {
  transform: scale(0.88);
  opacity: 0.8;
}

.goals-error {
  margin-top: 1rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.goals-loading {
  margin-top: 1rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.goals-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.goals-empty {
  margin-top: 1rem;
  text-align: center;
  color: var(--text-muted);
}

.goals-empty-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
}

.goals-empty-text {
  margin-top: 0.375rem;
  font-size: 0.8125rem;
}

.help-text {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-muted);
}

/* Animacion de alta/baja - mismo criterio que TransactionList.vue/
   WalletsMain.vue/DebtsMain.vue (TransitionGroup, no un v-for plano). */
.goal-item-move,
.goal-item-enter-active,
.goal-item-leave-active {
  transition:
    transform var(--duration-base) var(--ease-out),
    opacity var(--duration-base) var(--ease-out);
}

.goal-item-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.97);
}

.goal-item-leave-to {
  opacity: 0;
  transform: translateX(28px) scale(0.94);
}

.goal-item-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .goal-item-move,
  .goal-item-enter-active,
  .goal-item-leave-active {
    transition: opacity var(--duration-fast) linear;
  }

  .goal-item-enter-from,
  .goal-item-leave-to {
    transform: none;
  }
}

/* Decision calcada de DebtsMain.vue: lista en una sola columna ancha en
   escritorio, NO 2-up con CSS multi-column - BaseCard usa backdrop-filter
   siempre (stacking context propio) y Chromium tiene bugs conocidos de que
   break-inside:avoid no es confiable ahi. */
@media (min-width: 1024px) {
  .goals-screen {
    max-width: 68rem;
    display: grid;
    grid-template-columns: 18rem 1fr;
    grid-template-areas:
      'summary  list'
      'pending  list'
      'toolbar  list'
      'status   list'
      'empty    list';
    column-gap: 2rem;
    row-gap: 1rem;
    align-items: start;
  }

  .summary-grid {
    grid-area: summary;
    grid-template-columns: 1fr;
  }

  .pending-section {
    grid-area: pending;
    margin-top: 0;
  }

  .goals-toolbar {
    grid-area: toolbar;
    flex-direction: column;
    align-items: stretch;
    margin-top: 0;
  }

  .goals-error,
  .goals-loading {
    grid-area: status;
    margin-top: 0;
  }

  .goals-list {
    grid-area: list;
    margin-top: 0;
  }

  .goals-empty {
    grid-area: empty;
    margin-top: 0;
  }
}

@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .summary-grid {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .pending-section {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 50ms;
  }

  .goals-toolbar {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 100ms;
  }

  .goal-item-appear-active {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .goals-list > .goal-item-appear-active:nth-child(2) {
    animation-delay: 50ms;
  }

  .goals-list > .goal-item-appear-active:nth-child(3) {
    animation-delay: 100ms;
  }

  .goals-list > .goal-item-appear-active:nth-child(4) {
    animation-delay: 150ms;
  }

  .goals-list > .goal-item-appear-active:nth-child(n + 5) {
    animation-delay: 200ms;
  }
}
</style>
