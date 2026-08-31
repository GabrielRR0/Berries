<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDebts } from '../../composables/debts/useDebts'
import type { CreateDebtInput, DebtDirection } from '../../services/debts/interfaces/debts.interface'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import PillToggle from '../ui/PillToggle.vue'
import CreateDebtForm from './CreateDebtForm.vue'
import DebtCard from './DebtCard.vue'

// Pantalla "Deudas" (/deudas) - pedido explicito del usuario: "los estilos y
// animaciones deben cuidarse" aca, mismo nivel de pulido que Movimientos/
// Cuentas, reusando piezas ya genericas en vez de duplicar markup:
// PillToggle.vue para el filtro Todas/Te deben/Debes (antes duplicaba el
// mismo CSS a mano) y AnimatedCurrency para los montos (antes texto plano
// con formatCurrency, unico lugar de la app sin el odometro). El alta
// tambien pasa a bottom sheet, igual criterio que el resto de la app.
// SectionHeader (volver+titulo+ayuda) agregado despues, pedido explicito
// del usuario: "debe tener lo mismo... el boton de ir hacia atras y el
// boton de info, asi como movimientos o cuentas".
type FilterValue = DebtDirection | 'all'

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'owed_to_user', label: 'Te deben' },
  { value: 'owed_by_user', label: 'Debes' },
]

const router = useRouter()

const { debts, summary, isLoading, error, fetchDebts, fetchSummary, create, remove, payInstallment, unpayInstallment } =
  useDebts()

const activeFilter = ref<FilterValue>('all')
const showCreateSheet = ref(false)
const showHelpSheet = ref(false)
const isSubmitting = ref(false)

function goBack() {
  router.push({ name: 'dashboard' })
}

function directionParam(filter: FilterValue): DebtDirection | undefined {
  return filter === 'all' ? undefined : filter
}

async function onFilterChange(value: string) {
  const filter = value as FilterValue
  activeFilter.value = filter
  await fetchDebts(directionParam(filter))
}

async function onCreate(input: CreateDebtInput) {
  isSubmitting.value = true
  try {
    await create(input)
    showCreateSheet.value = false
  } catch {
    // El mensaje ya queda expuesto via el "error" reactivo del composable -
    // no hace falta duplicar el manejo aca, solo evitar que el formulario se
    // cierre cuando la creacion falla.
  } finally {
    isSubmitting.value = false
  }
}

async function onRemove(debtId: string) {
  await remove(debtId).catch(() => {
    // Mismo criterio: el error ya queda en el "error" reactivo del composable.
  })
}

async function onPay(debtId: string, installmentId: string) {
  await payInstallment(debtId, installmentId).catch(() => {})
}

async function onUnpay(debtId: string, installmentId: string) {
  await unpayInstallment(debtId, installmentId).catch(() => {})
}

const hasDebts = computed(() => debts.value.length > 0)

onMounted(() => {
  fetchDebts()
  fetchSummary()
})
</script>

<template>
  <PageShell>
    <SectionHeader title="Deudas" max-width="68rem" @back="goBack" @help="showHelpSheet = true" />

    <div class="debts-screen">
      <div class="summary-grid">
        <BaseCard class="summary-card">
          <p class="summary-label">Te deben</p>
          <p class="summary-amount">
            <AnimatedCurrency :value="summary?.totalOwedToUser ?? 0" currency="USD" direction="up" />
          </p>
        </BaseCard>

        <BaseCard class="summary-card">
          <p class="summary-label">Debes</p>
          <p class="summary-amount owed">
            <AnimatedCurrency :value="summary?.totalOwedByUser ?? 0" currency="USD" direction="down" />
          </p>
        </BaseCard>
      </div>

      <div class="debts-toolbar">
        <PillToggle :options="FILTER_OPTIONS" :model-value="activeFilter" @update:model-value="onFilterChange" />

        <button type="button" class="add-debt-button" aria-label="Agregar deuda" @click="showCreateSheet = true">
          +
        </button>
      </div>

      <p v-if="error" class="debts-error" role="alert">{{ error }}</p>
      <p v-if="isLoading" class="debts-loading">Cargando deudas...</p>

      <TransitionGroup
        v-if="hasDebts"
        tag="div"
        name="debt-item"
        class="debts-list"
        appear
        appear-active-class="debt-item-appear-active"
      >
        <DebtCard
          v-for="debt in debts"
          :key="debt.id"
          :debt="debt"
          @remove="onRemove(debt.id)"
          @pay="onPay(debt.id, $event)"
          @unpay="onUnpay(debt.id, $event)"
        />
      </TransitionGroup>

      <BaseCard v-else-if="!isLoading" class="debts-empty">
        <p class="debts-empty-title">No hay deudas registradas</p>
        <p class="debts-empty-text">Usa el botón “+” para registrar la primera.</p>
      </BaseCard>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Deudas?" @close="showHelpSheet = false">
      <p class="help-text">
        Aquí llevas el control de lo que te deben y lo que debes. Puedes registrar una deuda de pago único o dividida
        en cuotas, marcar cada cuota como pagada cuando corresponda, y filtrar la lista según la dirección de la deuda.
      </p>
    </BottomSheet>

    <BottomSheet v-if="showCreateSheet" title="Nueva deuda" @close="showCreateSheet = false">
      <CreateDebtForm :submitting="isSubmitting" @create="onCreate" @cancel="showCreateSheet = false" />
    </BottomSheet>
  </PageShell>
</template>

<style scoped>
.debts-screen {
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

.summary-amount.owed {
  color: var(--accent);
}

.debts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.add-debt-button {
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
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.add-debt-button:hover {
  opacity: 0.9;
}

.add-debt-button:active {
  transform: scale(0.88);
  opacity: 0.8;
}

.debts-error {
  margin-top: 1rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.debts-loading {
  margin-top: 1rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.debts-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.debts-empty {
  margin-top: 1rem;
  text-align: center;
  color: var(--text-muted);
}

.debts-empty-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
}

.debts-empty-text {
  margin-top: 0.375rem;
  font-size: 0.8125rem;
}

.help-text {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-muted);
}

/* Animacion de alta/baja - mismo criterio que TransactionList.vue/
   WalletsMain.vue (TransitionGroup, no un v-for plano). */
.debt-item-move,
.debt-item-enter-active,
.debt-item-leave-active {
  transition:
    transform var(--duration-base) var(--ease-out),
    opacity var(--duration-base) var(--ease-out);
}

.debt-item-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.97);
}

.debt-item-leave-to {
  opacity: 0;
  transform: translateX(28px) scale(0.94);
}

.debt-item-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .debt-item-move,
  .debt-item-enter-active,
  .debt-item-leave-active {
    transition: opacity var(--duration-fast) linear;
  }

  .debt-item-enter-from,
  .debt-item-leave-to {
    transform: none;
  }
}

/* Decision ya tomada (no una opcion a probar): la lista de deudas se queda
   en una sola columna ancha en escritorio, NO 2-up con CSS multi-column -
   BaseCard usa backdrop-filter siempre (stacking context propio) y Chromium
   tiene bugs conocidos de que break-inside:avoid no es confiable ahi, mas
   cada mutacion de useDebts.ts reemplaza el array entero (refetchAll), lo
   que en un columns:2 correria el balance de columnas en cada alta/baja/pago.
   En cambio: sidebar angosto (resumen+toolbar) + una columna ancha para la
   lista, misma resolucion que Movimientos. */
@media (min-width: 1024px) {
  .debts-screen {
    max-width: 68rem;
    display: grid;
    grid-template-columns: 18rem 1fr;
    grid-template-areas:
      'summary  list'
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

  .debts-toolbar {
    grid-area: toolbar;
    flex-direction: column;
    align-items: stretch;
    margin-top: 0;
  }

  .debts-error,
  .debts-loading {
    grid-area: status;
    margin-top: 0;
  }

  .debts-list {
    grid-area: list;
    margin-top: 0;
  }

  .debts-empty {
    grid-area: empty;
    margin-top: 0;
  }
}

/* Animacion de entrada al cargar Deudas en escritorio - bloque separado con
   guard extra de prefers-reduced-motion. .debts-list queda afuera: ya tiene
   su propio stagger via TransitionGroup + appear (ver mas abajo). */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .summary-grid {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .debts-toolbar {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 50ms;
  }
}

/* "appear" (no :nth-child sobre .debt-item) - dispara solo en el mount
   inicial real, sin reanimarse cada vez que se crea/borra/paga una deuda en
   vivo (lo que competiria con .debt-item-enter-active de arriba). Fill-mode
   "backwards", ver @keyframes content-enter en style.css. */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .debt-item-appear-active {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .debts-list > .debt-item-appear-active:nth-child(2) {
    animation-delay: 50ms;
  }

  .debts-list > .debt-item-appear-active:nth-child(3) {
    animation-delay: 100ms;
  }

  .debts-list > .debt-item-appear-active:nth-child(4) {
    animation-delay: 150ms;
  }

  .debts-list > .debt-item-appear-active:nth-child(n + 5) {
    animation-delay: 200ms;
  }
}
</style>
