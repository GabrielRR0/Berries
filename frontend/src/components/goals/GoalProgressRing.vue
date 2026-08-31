<script setup lang="ts">
import { computed } from 'vue'

// Gauge circular de progreso (reemplaza la barra lineal anterior) - pedido
// explicito del usuario con capturas de referencia de otra app (layout
// solamente, la paleta sigue siendo la de Berry - rojo, no el verde de la
// referencia). El icono central llega por slot (ver GoalTypeIcon.vue) para
// que este componente no sepa nada de "tipos de meta".
// "glow" (pedido explicito del usuario, eligiendo entre 3 direcciones de
// diseño mostradas en un canvas): variante mas gruesa + resplandor detras del
// trazo, reservada para GoalCard.vue - CreateGoalWizard.vue sigue usando el
// anillo fino de siempre para su preview del paso a paso.
const props = withDefaults(defineProps<{ percent: number; size?: number; glow?: boolean }>(), {
  size: 96,
  glow: false,
})

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const clampedPercent = computed(() => Math.min(100, Math.max(0, props.percent)))
const dashOffset = computed(() => CIRCUMFERENCE * (1 - clampedPercent.value / 100))

// Punto al final del arco - mismo "dot" llamativo que la referencia visual, marca
// donde termina el progreso incluso cuando el arco es muy corto (ej. 2%).
const endPoint = computed(() => {
  // -90deg de offset: el arco arranca en las 12, no a las 3 (default de SVG).
  const angle = (clampedPercent.value / 100) * 2 * Math.PI - Math.PI / 2
  return { x: 50 + RADIUS * Math.cos(angle), y: 50 + RADIUS * Math.sin(angle) }
})
</script>

<template>
  <div class="goal-progress-ring" :class="{ glow }" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 100 100" class="ring-svg">
      <circle class="ring-track" cx="50" cy="50" :r="RADIUS" />
      <circle
        class="ring-fill"
        cx="50"
        cy="50"
        :r="RADIUS"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="dashOffset"
        transform="rotate(-90 50 50)"
      />
      <circle v-if="clampedPercent > 0" class="ring-end-dot" :cx="endPoint.x" :cy="endPoint.y" r="4" />
    </svg>
    <div class="ring-center">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.goal-progress-ring {
  position: relative;
  flex-shrink: 0;
}

.ring-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.ring-track {
  fill: none;
  stroke: var(--border-subtle);
  stroke-width: 8;
}

.ring-fill {
  fill: none;
  stroke: var(--accent);
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset var(--duration-base) var(--ease-out);
}

.goal-progress-ring.glow .ring-track,
.goal-progress-ring.glow .ring-fill {
  stroke-width: 10;
}

.goal-progress-ring.glow .ring-fill {
  filter: drop-shadow(0 0 0.625rem rgba(239, 68, 68, 0.27));
}

.ring-end-dot {
  fill: var(--accent);
  transition:
    cx var(--duration-base) var(--ease-out),
    cy var(--duration-base) var(--ease-out);
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
