<script setup lang="ts">
import { computed, ref } from 'vue'
import { quickActionLocation } from '../../composables/navigation/useQuickActions'
import { useQuickRegister } from '../../composables/quickRegister/useQuickRegister'
import { useOnboardingTour } from '../../composables/onboarding/useOnboardingTour'
import { useScrollIntoViewOnActive } from '../../composables/onboarding/useScrollIntoViewOnActive'
import CoachMarkTooltip from '../ui/CoachMarkTooltip.vue'
import IconBadge from '../ui/IconBadge.vue'

// Fila de 4 accesos rapidos (mockup aprobado): Registrar, Por voz, Escanear y
// Transferir. Los tres primeros abren el panel global "Registrar" (sin
// navegar, ver composables/quickRegister/) - Registrar pregunta primero como,
// Por voz abre el grabador y Escanear el selector de foto -, y Transferir
// lleva a Cuentas con su sheet abierto (useQuickActions.ts). Metas, Cuentas y
// Ajustes siguen a un toque: Cuentas esta en la barra flotante, Metas y
// Ajustes en el Menu.
const quickRegister = useQuickRegister()
const ACTIONS = [
  { id: 'registrar', label: 'Registrar', run: (from: Element) => quickRegister.open(from) },
  { id: 'voz', label: 'Por voz', run: () => quickRegister.requestVoice() },
  { id: 'escanear', label: 'Escanear', run: () => quickRegister.requestReceipt() },
  { id: 'transferir', label: 'Transferir', to: quickActionLocation('transferir') },
] as const

// Pasos 3-6 del tour guiado de Inicio (ver BalanceCard.vue/
// IncomeExpenseSummary.vue/useOnboardingTour.ts) - pedido explicito del
// usuario: cada acceso rapido explica "super resumido super corto" que hace.
// Un solo CoachMarkTooltip debajo del grid (no uno por icono) cuyo contenido
// cambia con el paso activo; el boton correspondiente se resalta con un
// anillo para dejar claro a cual se refiere.
const { currentStep, stepPosition, isFirstStep, isLastStep, next, back, close } = useOnboardingTour()
const QUICK_ACTION_STEP_IDS: string[] = ACTIONS.map((action) => action.id)
const showTourCoachMark = computed(() => QUICK_ACTION_STEP_IDS.includes(currentStep.value?.id ?? ''))
const gridRef = ref<HTMLElement | null>(null)
// Pedido explicito del usuario: aunque este grid suele estar visible cerca
// del principio, si el usuario ya bajo la pagina (ej. viniendo del paso de
// Ingresos/Gastos) hay que scrollear de vuelta hasta aca.
useScrollIntoViewOnActive(gridRef, showTourCoachMark)
</script>

<template>
  <div ref="gridRef" class="quick-actions">
    <component
      :is="'to' in action ? 'RouterLink' : 'button'"
      v-for="action in ACTIONS"
      :key="action.id"
      v-bind="
        'to' in action
          ? { to: action.to }
          : { type: 'button', onClick: (event: MouseEvent) => action.run(event.currentTarget as Element) }
      "
      class="quick-action"
      :class="{ 'tour-active': currentStep?.id === action.id }"
    >
      <IconBadge size="lg" :variant="action.id === 'registrar' ? 'accent' : 'neutral'">
        <svg v-if="action.id === 'registrar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
        <svg v-else-if="action.id === 'voz'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke-linecap="round" />
        </svg>
        <svg v-else-if="action.id === 'escanear'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7h13l-3-3M20 17H7l3 3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </IconBadge>
      <span class="quick-action-label">{{ action.label }}</span>
    </component>

    <CoachMarkTooltip
      v-if="showTourCoachMark && currentStep"
      class="quick-actions-coach-mark"
      :title="currentStep.title"
      :text="currentStep.text"
      :step-label="stepPosition"
      :show-back="!isFirstStep"
      :next-label="isLastStep ? 'Entendido' : 'Continuar'"
      @dismiss="close"
      @back="back"
      @next="next"
    />
  </div>
</template>

<style scoped>
.quick-actions {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.quick-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem;
  border: none;
  background: transparent;
  color: var(--text);
  text-decoration: none;
  cursor: pointer;
  font: inherit;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.quick-action:hover {
  opacity: 0.85;
}

/* Solo el circulo de icono se achica (no la fila completa, que tambien
   incluye el label) - se ve como si se "presionara" el boton, no como si
   toda la columna se encogiera de forma rara. Vue asigna el atributo de
   scope del padre a la raiz de un componente hijo, asi que este selector
   (sin :deep) llega a .icon-badge sin problema - confirmado. */
.quick-action:active .icon-badge {
  transform: scale(0.88);
  opacity: 0.75;
}

/* Resalta a cual acceso rapido se refiere el paso activo del tour guiado -
   un solo CoachMarkTooltip vive debajo de todo el grid (ver template), asi
   que este anillo es lo que deja claro cual de los 4 iconos describe. */
.quick-action.tour-active .icon-badge {
  box-shadow: 0 0 0 2px var(--accent);
}

/* Flotante (position:absolute) - mismo criterio que IncomeExpenseSummary.vue:
   antes ocupaba su propia fila del grid ("grid-column: 1 / -1") y empujaba
   el contenido de abajo. Absoluto = no le suma alto al grid. */
.quick-actions-coach-mark {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  z-index: 5;
}

.quick-action-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
}
</style>
