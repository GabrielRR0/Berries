<script setup lang="ts">
import { computed, ref } from 'vue'
import { useOnboardingTour } from '../../composables/onboarding/useOnboardingTour'
import { useScrollIntoViewOnActive } from '../../composables/onboarding/useScrollIntoViewOnActive'
import CoachMarkTooltip from '../ui/CoachMarkTooltip.vue'
import IconBadge from '../ui/IconBadge.vue'

// Grid de 4 accesos rapidos (ver capturas de referencia "Rial"). Los 4 son
// RouterLink reales (ver router/index.ts) - Calculadora se movio a Ajustes
// (SettingsMenuMain.vue) y este cupo pasa a Metas, pedido explicito del
// usuario. Calculadora en si sigue existiendo, ver
// components/calculator/CalculatorMain.vue.

// Pasos 3-6 del tour guiado de Inicio (ver BalanceCard.vue/
// IncomeExpenseSummary.vue/useOnboardingTour.ts) - pedido explicito del
// usuario: cada acceso rapido explica "super resumido super corto" que hace.
// Un solo CoachMarkTooltip debajo del grid (no uno por icono) cuyo contenido
// cambia con el paso activo; el boton correspondiente se resalta con un
// anillo para dejar claro a cual se refiere.
const { currentStep, stepPosition, isFirstStep, isLastStep, next, back, close } = useOnboardingTour()
const QUICK_ACTION_STEP_IDS = ['metas', 'movimientos', 'cuentas', 'ajustes']
const showTourCoachMark = computed(() => QUICK_ACTION_STEP_IDS.includes(currentStep.value?.id ?? ''))
const gridRef = ref<HTMLElement | null>(null)
// Pedido explicito del usuario: aunque este grid suele estar visible cerca
// del principio, si el usuario ya bajo la pagina (ej. viniendo del paso de
// Ingresos/Gastos) hay que scrollear de vuelta hasta aca.
useScrollIntoViewOnActive(gridRef, showTourCoachMark)
</script>

<template>
  <div ref="gridRef" class="quick-actions">
    <RouterLink to="/metas" class="quick-action" :class="{ 'tour-active': currentStep?.id === 'metas' }">
      <IconBadge size="lg">
        <!-- Bullseye simple (3 circulos concentricos) - misma logica que el
           gear de Ajustes mas abajo: a este tamaño de icono, un simbolo con
           pocos trazos se lee mejor que uno detallado. -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="0.5" fill="currentColor" />
        </svg>
      </IconBadge>
      <span class="quick-action-label">Metas</span>
    </RouterLink>

    <RouterLink to="/movimientos" class="quick-action" :class="{ 'tour-active': currentStep?.id === 'movimientos' }">
      <IconBadge size="lg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7h13l-3-3M17 7l-3 3" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M20 17H7l3-3M7 17l3 3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </IconBadge>
      <span class="quick-action-label">Movimientos</span>
    </RouterLink>

    <RouterLink to="/cuentas" class="quick-action" :class="{ 'tour-active': currentStep?.id === 'cuentas' }">
      <IconBadge size="lg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18" />
          <path d="M16 15h2" stroke-linecap="round" />
        </svg>
      </IconBadge>
      <span class="quick-action-label">Cuentas</span>
    </RouterLink>

    <RouterLink to="/ajustes" class="quick-action" :class="{ 'tour-active': currentStep?.id === 'ajustes' }">
      <IconBadge size="lg">
        <!-- Gear simple (circulo + 8 lineas radiales) en vez del path
           original (muy detallado, con muchos arcos chicos) - a este
           tamaño de icono se veia "sucio"/roto, inconsistente con la
           simplicidad de los otros 3 (rect+lineas, flechas). -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3.5" />
          <path
            d="M12 2.5v3M12 18.5v3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M2.5 12h3M18.5 12h3M4.4 19.6l2.1-2.1M17.5 6.5l2.1-2.1"
            stroke-linecap="round"
          />
        </svg>
      </IconBadge>
      <span class="quick-action-label">Ajustes</span>
    </RouterLink>

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
