import { computed, ref } from 'vue'

// Tour guiado de Inicio (pedido explicito del usuario): al tocar el "?" del
// header aparece una secuencia de CoachMarkTooltip con Continuar/Atrás que
// va señalando, en orden, el balance, las boxes de Ingresos/Gastos y cada
// acceso rapido (Registrar, Por voz, Escanear, Transferir). Estado compartido a nivel de modulo (mismo criterio que
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
  { id: 'registrar', title: 'Registrar', text: 'Anota un ingreso o un gasto en segundos.' },
  { id: 'voz', title: 'Por voz', text: 'Dicta el movimiento y Berry lo completa por ti.' },
  {
    id: 'escanear',
    title: 'Escanear',
    text: 'Sube capturas de tu banco y registra varios movimientos de una vez.',
  },
  { id: 'transferir', title: 'Transferir', text: 'Mueve dinero entre tus cuentas, incluso de distinta moneda.' },
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
