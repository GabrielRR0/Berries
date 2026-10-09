<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RateHistoryPoint } from '../../services/currency/interfaces/currency.interface'
import { buildTrendPath } from '../../utils/charts/buildTrendPath'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { formatDate } from '../../utils/formatters/formatDate'

// Grafico de linea hecho a mano (mismo espiritu sin libreria que
// BalanceTrendBackdrop.vue/CategoryMonthlyTrendChart.vue) para la serie
// historica de una moneda nacional vs. USD (o USDT, ver quoteCode) - pedido
// explicito del usuario: "tener un grafico de como sube o baja su valor". A
// diferencia de BalanceTrendBackdrop.vue (decorativo, sin interaccion), esta
// es la pieza PRINCIPAL de la pantalla "Tasas", asi que suma ejes minimos +
// hover con tooltip (ver skill dataviz: "un chart HTML/SVG ES interactivo
// por default").
const props = withDefaults(
  defineProps<{ points: RateHistoryPoint[]; currencyCode: string; quoteCode?: string }>(),
  { quoteCode: 'USD' },
)

const VIEW_WIDTH = 320
const VIEW_HEIGHT = 160
const PADDING_Y = 12

const rates = computed(() => props.points.map((point) => point.rate))
const trend = computed(() => buildTrendPath(rates.value, VIEW_WIDTH, VIEW_HEIGHT, PADDING_Y))

// Coordenadas por punto (misma normalizacion que buildTrendPath.ts, que solo
// expone el path ya armado + el ultimo punto) - hacen falta todas para el
// hover/crosshair y para marcar los puntos estimados, asi que se calculan
// aca en vez de ampliar el contrato de ese util compartido.
const pointCoords = computed<[number, number][]>(() => {
  const values = rates.value
  if (values.length < 2) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const usableHeight = VIEW_HEIGHT - PADDING_Y * 2
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * VIEW_WIDTH
    const y = PADDING_Y + usableHeight - ((value - min) / range) * usableHeight
    return [x, y]
  })
})

const estimatedPointCoords = computed(() =>
  pointCoords.value.filter((_, index) => props.points[index]?.isEstimated),
)

const hasEstimatedPoints = computed(() => estimatedPointCoords.value.length > 0)

// Hasta 4 etiquetas de fecha en el eje X (primera/ultima siempre, un par de
// intermedias) - mostrar una por punto colisionaria con series largas (12+
// meses de historial), ver skill dataviz (paso 7, "look at it": colisiones
// de labels).
const xAxisLabels = computed(() => {
  const total = props.points.length
  if (total === 0) return []
  const labelCount = Math.min(4, total)
  const indexes = new Set<number>()
  for (let i = 0; i < labelCount; i++) {
    indexes.add(Math.round((i / (labelCount - 1 || 1)) * (total - 1)))
  }
  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map((index) => ({ index, x: pointCoords.value[index]?.[0] ?? 0, label: formatDate(props.points[index]!.fetchedAt) }))
})

const yAxisBounds = computed(() => {
  if (rates.value.length === 0) return null
  return { min: Math.min(...rates.value), max: Math.max(...rates.value) }
})

const svgRef = ref<SVGSVGElement | null>(null)
const hoverIndex = ref<number | null>(null)

function nearestIndexFromClientX(clientX: number): number | null {
  const svg = svgRef.value
  if (!svg || pointCoords.value.length === 0) return null
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = 0
  const userPoint = point.matrixTransform(ctm.inverse())

  let closestIndex = 0
  let closestDistance = Infinity
  pointCoords.value.forEach(([x], index) => {
    const distance = Math.abs(x - userPoint.x)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = index
    }
  })
  return closestIndex
}

function onPointerMove(event: PointerEvent) {
  hoverIndex.value = nearestIndexFromClientX(event.clientX)
}

function onPointerLeave() {
  hoverIndex.value = null
}

const hoverPoint = computed(() => (hoverIndex.value === null ? null : props.points[hoverIndex.value] ?? null))
const hoverCoord = computed(() => (hoverIndex.value === null ? null : pointCoords.value[hoverIndex.value] ?? null))
// Lado del tooltip: si el punto esta en la mitad derecha del grafico, el
// tooltip se ancla a la izquierda del cursor (y viceversa) - evita que se
// corte contra el borde del contenedor.
const tooltipSide = computed(() => (hoverCoord.value && hoverCoord.value[0] > VIEW_WIDTH / 2 ? 'left' : 'right'))

const trendSummaryLabel = computed(() => {
  const bounds = yAxisBounds.value
  if (!bounds) return `Sin historial disponible para ${props.currencyCode}.`
  return `${props.currencyCode} por ${props.quoteCode}: mínimo ${formatCurrency(bounds.min, props.currencyCode)}, máximo ${formatCurrency(bounds.max, props.currencyCode)} en el período mostrado.`
})
</script>

<template>
  <div class="rate-history-chart">
    <p v-if="points.length < 2" class="rate-history-empty">Todavía no hay suficiente historial para graficar.</p>

    <template v-else>
      <div class="chart-canvas" role="img" :aria-label="trendSummaryLabel">
        <svg
          ref="svgRef"
          :viewBox="`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`"
          preserveAspectRatio="none"
          class="chart-svg"
          @pointermove="onPointerMove"
          @pointerleave="onPointerLeave"
        >
          <path :d="trend.areaPath" class="chart-area" />
          <path :d="trend.linePath" class="chart-line" />

          <!-- Puntos estimados (respaldo, no una lectura real de mercado -
               ver is_estimated en cache_refresh.py del backend): anillo hueco
               en vez de solo un cambio de color, para que la diferencia no
               dependa unicamente de percibir un tono (ver skill dataviz,
               "identity nunca solo color"). -->
          <circle
            v-for="([x, y], index) in estimatedPointCoords"
            :key="index"
            :cx="x"
            :cy="y"
            r="3.5"
            class="chart-estimated-dot"
          />

          <g v-if="hoverCoord">
            <line :x1="hoverCoord[0]" :x2="hoverCoord[0]" y1="0" :y2="VIEW_HEIGHT" class="chart-crosshair" />
            <circle :cx="hoverCoord[0]" :cy="hoverCoord[1]" r="4" class="chart-hover-dot" />
          </g>
        </svg>

        <div
          v-if="hoverPoint && hoverCoord"
          class="chart-tooltip"
          :class="tooltipSide"
          :style="{ left: `${(hoverCoord[0] / VIEW_WIDTH) * 100}%`, top: `${(hoverCoord[1] / VIEW_HEIGHT) * 100}%` }"
        >
          <span class="chart-tooltip-date">{{ formatDate(hoverPoint.fetchedAt) }}</span>
          <span class="chart-tooltip-rate">{{ formatCurrency(hoverPoint.rate, currencyCode) }} por {{ quoteCode }}</span>
          <span v-if="hoverPoint.isEstimated" class="chart-tooltip-estimated">estimada</span>
        </div>
      </div>

      <div class="chart-x-axis">
        <span v-for="label in xAxisLabels" :key="label.index" class="chart-x-label">{{ label.label }}</span>
      </div>

      <div v-if="yAxisBounds" class="chart-y-axis">
        <span>Máx: {{ formatCurrency(yAxisBounds.max, currencyCode) }}</span>
        <span>Mín: {{ formatCurrency(yAxisBounds.min, currencyCode) }}</span>
      </div>

      <p v-if="hasEstimatedPoints" class="chart-legend">
        <span class="chart-legend-dot" aria-hidden="true" /> estimada (sin lectura real de mercado ese día)
      </p>
    </template>
  </div>
</template>

<style scoped>
.rate-history-chart {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rate-history-empty {
  padding: 1.5rem 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.chart-canvas {
  position: relative;
  width: 100%;
  height: 11rem;
}

.chart-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  touch-action: none;
}

.chart-area {
  fill: var(--accent-muted);
  opacity: 0.6;
}

.chart-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chart-estimated-dot {
  fill: var(--bg-surface);
  stroke: var(--accent);
  stroke-width: 1.5;
  stroke-dasharray: 2 1.5;
}

.chart-crosshair {
  stroke: var(--border);
  stroke-width: 1;
}

.chart-hover-dot {
  fill: var(--accent);
  stroke: var(--bg-surface);
  stroke-width: 1.5;
}

.chart-tooltip {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  transform: translateY(-100%);
  margin-top: -0.5rem;
  padding: 0.375rem 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--bg-surface);
  box-shadow: var(--shadow-md);
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1;
}

.chart-tooltip.right {
  transform: translate(0, -100%);
}

.chart-tooltip.left {
  transform: translate(-100%, -100%);
}

.chart-tooltip-date {
  color: var(--text-muted);
}

.chart-tooltip-rate {
  font-weight: 700;
  color: var(--text-h);
}

.chart-tooltip-estimated {
  color: var(--accent);
  font-weight: 600;
}

.chart-x-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.chart-y-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-h);
}

.chart-legend {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.chart-legend-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--bg-surface);
  border: 1.5px dashed var(--accent);
}
</style>
