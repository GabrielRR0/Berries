import { computed, ref } from 'vue'

// Tour guiado de Inicio (pedido explicito del usuario): al tocar el "?" del
// header aparece una secuencia de CoachMarkTooltip con Continuar/Atrás que
// va señalando, en orden, el balance, las boxes de Ingresos/Gastos y cada
// acceso rapido. Estado compartido a nivel de modulo (mismo criterio que
// usePageTransition.ts) porque quien "es dueño" de cada paso vive en
// componentes hermanos sin relacion padre/hijo entre ellos (BalanceCard,
// IncomeExpenseSummary, QuickActionsGrid) - todos necesitan leer y avanzar
// el MISMO indice de paso.
export interface TourStep {
  id: string
  title: string
  text: string
}

const TOUR_STEPS: TourStep[] = [
  { id: 'balance-visibility', title: 'Oculta tu balance', text: 'Toca el ojo cuando estés en un lugar público.' },
  {
    id: 'income-expense',
    title: 'Ingresos y gastos',
    text: 'Toca cualquiera de los dos para ver el detalle del mes y registrar un movimiento.',
  },
  {
    id: 'metas',
    title: 'Metas',
    text: 'Planifica una compra futura y separa un poco cada mes hasta lograrla.',
  },
  { id: 'movimientos', title: 'Movimientos', text: 'Tu historial completo de ingresos y gastos.' },
  { id: 'cuentas', title: 'Cuentas', text: 'Tus billeteras en cada moneda, con su balance.' },
  { id: 'ajustes', title: 'Ajustes', text: 'Tu perfil, sesión y preferencias de la app.' },
]

const activeStepIndex = ref<number | null>(null)

export function useOnboardingTour() {
  const currentStep = computed<TourStep | null>(() =>
    activeStepIndex.value === null ? null : TOUR_STEPS[activeStepIndex.value] ?? null,
  )
  const stepPosition = computed(() =>
    activeStepIndex.value === null ? '' : `${activeStepIndex.value + 1}/${TOUR_STEPS.length}`,
  )
  const isFirstStep = computed(() => activeStepIndex.value === 0)
  const isLastStep = computed(() => activeStepIndex.value === TOUR_STEPS.length - 1)

  function start() {
    activeStepIndex.value = 0
  }

  function next() {
    if (activeStepIndex.value === null) return
    if (activeStepIndex.value >= TOUR_STEPS.length - 1) {
      activeStepIndex.value = null
      return
    }
    activeStepIndex.value += 1
  }

  function back() {
    if (!activeStepIndex.value) return
    activeStepIndex.value -= 1
  }

  function close() {
    activeStepIndex.value = null
  }

  return { currentStep, stepPosition, isFirstStep, isLastStep, start, next, back, close }
}
