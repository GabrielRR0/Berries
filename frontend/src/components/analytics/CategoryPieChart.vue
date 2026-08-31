<script setup lang="ts">
import { computed } from 'vue'
import type { CategoryBreakdown } from '../../services/analytics/interfaces/analytics.interface'

// Donut de categorias, sin libreria de charts (ver limites del trabajo):
// circulos SVG con stroke-dasharray/stroke-dashoffset. Berry tiene un unico
// acento de marca (rojo, reservado para gasto/negativo en el resto de la
// app - ver style.css) asi que esto NO asigna un color por categoria: usa
// una rampa de grises con los tokens ya existentes, y la identidad de cada
// categoria vive en la lista de al lado (nombre + porcentaje), nunca solo en
// el color.
const props = defineProps<{ data: CategoryBreakdown[] }>()

const TONES = ['var(--text-h)', 'var(--text)', 'var(--text-muted)', 'var(--border)', 'var(--bg-raised)']

const RADIUS = 15.5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface Segment {
  category: string
  percentage: number
  total: number
  color: string
  dasharray: string
  dashoffset: number
}

const segments = computed<Segment[]>(() => {
  let cumulativePercent = 0
  return props.data.map((entry, index) => {
    const dash = (entry.percentage / 100) * CIRCUMFERENCE
    const segment: Segment = {
      category: entry.category,
      percentage: entry.percentage,
      total: entry.total,
      color: TONES[index % TONES.length],
      dasharray: `${dash} ${Math.max(0, CIRCUMFERENCE - dash)}`,
      // Offset negativo para que cada tramo arranque donde termino el
      // anterior; rotate(-90) en el <circle> lo pone a partir de las 12.
      dashoffset: -((cumulativePercent / 100) * CIRCUMFERENCE),
    }
    cumulativePercent += entry.percentage
    return segment
  })
})
</script>

<template>
  <div class="category-pie-chart">
    <svg viewBox="0 0 36 36" class="donut" role="img" :aria-label="`Distribución por categoría`">
      <circle cx="18" cy="18" :r="RADIUS" fill="none" stroke="var(--bg-inset)" stroke-width="4" />
      <circle
        v-for="segment in segments"
        :key="segment.category"
        cx="18"
        cy="18"
        :r="RADIUS"
        fill="none"
        :stroke="segment.color"
        stroke-width="4"
        stroke-linecap="round"
        :stroke-dasharray="segment.dasharray"
        :stroke-dashoffset="segment.dashoffset"
        transform="rotate(-90 18 18)"
      >
        <title>{{ segment.category }} — {{ segment.percentage.toFixed(1) }}%</title>
      </circle>
    </svg>

    <ul v-if="segments.length" class="category-legend">
      <li v-for="segment in segments" :key="segment.category" class="legend-item">
        <span class="legend-swatch" :style="{ backgroundColor: segment.color }" aria-hidden="true" />
        <span class="legend-label">{{ segment.category }}</span>
        <span class="legend-value">{{ segment.percentage.toFixed(1) }}%</span>
      </li>
    </ul>

    <p v-else class="category-empty">Sin datos para este período.</p>
  </div>
</template>

<style scoped>
.category-pie-chart {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.donut {
  width: 6.5rem;
  height: 6.5rem;
  flex-shrink: 0;
}

.category-legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-swatch {
  width: 0.625rem;
  height: 0.625rem;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
}

.legend-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  color: var(--text);
}

.legend-value {
  flex-shrink: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-h);
}

.category-empty {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

@media (max-width: 380px) {
  .category-pie-chart {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
