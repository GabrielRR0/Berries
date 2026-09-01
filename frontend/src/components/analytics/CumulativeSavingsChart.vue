<script setup lang="ts">
import { computed } from 'vue'
import type { MonthlyComparison } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'

// "Cuanto se ha ahorrado" ACUMULADO dentro de la ventana visible (los mismos
// meses que ya trae useAnalytics().monthlyComparison, ver
// analytics_service.py::get_monthly_comparison) - pedido explicito del
// usuario: sumar el ahorro (ingreso - gasto) mes a mes, no solo mostrar el
// neto de un mes suelto. Es un acumulado DENTRO de la ventana visible (3/6/12
// meses segun lo que pida AnalyticsMain.vue), no "de toda la vida de la
// cuenta" - esa serie no la trae el backend hoy - por eso el label aclara
// cuantos meses entran en la suma.
const props = withDefaults(defineProps<{ months: MonthlyComparison[]; currency?: string }>(), { currency: 'USD' })

interface CumulativePoint {
  month: string
  cumulative: number
  contribution: number
}

const points = computed<CumulativePoint[]>(() => {
  let running = 0
  return props.months.map((entry) => {
    running += entry.net
    return { month: entry.month, cumulative: running, contribution: entry.net }
  })
})

const total = computed(() => points.value.at(-1)?.cumulative ?? 0)
const lastContribution = computed(() => points.value.at(-1)?.contribution ?? 0)

const VIEW_WIDTH = 300
const VIEW_HEIGHT = 100
const PADDING_Y = 12

// Rango de la escala: siempre incluye 0 (aunque el acumulado nunca baje de
// ahi) para que la linea de base sea comparable entre distintas ventanas de
// meses, y para poder marcar "cero" cuando el acumulado cruza a negativo.
const scale = computed(() => {
  const values = points.value.map((p) => p.cumulative)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  return { min, max, range: max - min || 1 }
})

function xAt(index: number): number {
  const count = points.value.length
  return count <= 1 ? VIEW_WIDTH / 2 : (index / (count - 1)) * VIEW_WIDTH
}

function yAt(value: number): number {
  const { min, range } = scale.value
  return VIEW_HEIGHT - PADDING_Y - ((value - min) / range) * (VIEW_HEIGHT - PADDING_Y * 2)
}

// Y donde cae la linea de "cero" - solo tiene sentido dibujarla si el rango
// realmente cruza 0 en algun punto (si todo el acumulado es positivo, "cero"
// coincide con el piso del grafico y no aporta nada verla aparte).
const zeroLineY = computed(() => {
  const { min, max } = scale.value
  if (min >= 0 || max <= 0) return null
  return yAt(0)
})

// Sin libreria de charts (ver limites del trabajo) - mismo criterio hecho a
// mano que CategoryPieChart.vue/MonthlyComparisonTable.vue, y misma tecnica
// de suavizado (quadratic bezier a traves de puntos medios) que
// utils/charts/buildTrendPath.ts (BalanceCard.vue en Inicio) - no se
// reutiliza esa funcion tal cual porque ella siempre normaliza al min/max de
// la propia serie, mientras que este grafico necesita que la escala incluya
// SIEMPRE el 0 (ver "scale" arriba), asi que la curva se arma a mano con la
// misma logica de suavizado. preserveAspectRatio="none" a proposito: el
// contenedor fija el alto por CSS y el ancho es 100%, se estira sin mantener
// proporcion - el area/linea llenan todo el ancho disponible en cualquier
// tamaño de pantalla.
const linePath = computed(() => {
  const pts = points.value
  if (pts.length < 2) return ''
  const coords = pts.map((point, index): [number, number] => [xAt(index), yAt(point.cumulative)])
  let path = `M ${coords[0][0]},${coords[0][1]}`
  for (let i = 0; i < coords.length - 1; i++) {
    const [x0, y0] = coords[i]
    const [x1, y1] = coords[i + 1]
    path += ` Q ${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`
  }
  const [lastX, lastY] = coords[coords.length - 1]
  path += ` L ${lastX},${lastY}`
  return path
})

const areaPath = computed(() => {
  if (!linePath.value) return ''
  const lastX = xAt(points.value.length - 1)
  return `${linePath.value} L ${lastX},${VIEW_HEIGHT} L 0,${VIEW_HEIGHT} Z`
})

// Id unico del <linearGradient> - varias instancias de este componente en la
// misma pagina no pueden compartir el mismo id de gradiente (un <path
// fill="url(#x)"> tomaria el gradiente de la OTRA instancia, la que haya
// quedado ultima en el DOM).
const gradientId = `cumulative-area-fill-${Math.random().toString(36).slice(2, 9)}`

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-')
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  return new Intl.DateTimeFormat('es-VE', { month: 'short' }).format(date)
}
</script>

<template>
  <div class="cumulative-savings">
    <div class="cumulative-hero">
      <span class="cumulative-label">
        Ahorro acumulado ({{ months.length }} {{ months.length === 1 ? 'mes' : 'meses' }})
      </span>
      <p class="cumulative-value" :class="{ negative: total < 0 }">
        <AnimatedCurrency :value="total" :currency="currency" :direction="total < 0 ? 'down' : 'up'" compact-suffix />
      </p>
      <p v-if="points.length" class="cumulative-delta" :class="{ negative: lastContribution < 0 }">
        {{ lastContribution >= 0 ? '+' : '' }}{{ formatCurrency(lastContribution, currency) }} este mes
      </p>
    </div>

    <template v-if="linePath">
      <svg
        viewBox="0 0 300 100"
        preserveAspectRatio="none"
        class="cumulative-chart"
        role="img"
        :aria-label="`Evolución del ahorro acumulado en los últimos ${months.length} meses`"
      >
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--text-h)" stop-opacity="0.18" />
            <stop offset="100%" stop-color="var(--text-h)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line
          v-if="zeroLineY !== null"
          x1="0"
          :y1="zeroLineY"
          x2="300"
          :y2="zeroLineY"
          class="cumulative-zero-line"
          vector-effect="non-scaling-stroke"
        />
        <path :d="areaPath" class="cumulative-area" :fill="`url(#${gradientId})`" />
        <path :d="linePath" class="cumulative-line" vector-effect="non-scaling-stroke" />
        <circle
          v-for="(point, index) in points.slice(0, -1)"
          :key="point.month"
          :cx="xAt(index)"
          :cy="yAt(point.cumulative)"
          r="2.4"
          class="cumulative-dot"
          vector-effect="non-scaling-stroke"
        >
          <title>{{ monthLabel(point.month) }} — {{ formatCurrency(point.cumulative, currency) }}</title>
        </circle>
        <template v-if="points.length">
          <circle
            :cx="xAt(points.length - 1)"
            :cy="yAt(total)"
            r="8"
            class="cumulative-dot-glow"
            :class="{ negative: total < 0 }"
          />
          <circle
            :cx="xAt(points.length - 1)"
            :cy="yAt(total)"
            r="3.4"
            class="cumulative-dot-core"
            :class="{ negative: total < 0 }"
            vector-effect="non-scaling-stroke"
          >
            <title>{{ monthLabel(points[points.length - 1].month) }} — {{ formatCurrency(total, currency) }}</title>
          </circle>
        </template>
      </svg>

      <div class="cumulative-axis">
        <span v-for="point in points" :key="point.month" class="cumulative-axis-label">{{ monthLabel(point.month) }}</span>
      </div>
    </template>

    <p v-else class="cumulative-empty">Necesitamos al menos 2 meses de historial para graficar la evolución.</p>
  </div>
</template>

<style scoped>
.cumulative-savings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cumulative-hero {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cumulative-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.cumulative-value {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-h);
}

.cumulative-value.negative {
  color: var(--accent);
}

.cumulative-delta {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.cumulative-delta.negative {
  color: var(--accent);
}

.cumulative-chart {
  display: block;
  width: 100%;
  height: 6.5rem;
}

.cumulative-zero-line {
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.cumulative-line {
  fill: none;
  stroke: var(--text-h);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.cumulative-dot {
  fill: var(--bg);
  stroke: var(--text-h);
  stroke-width: 1.75;
}

/* Punto "en vivo" del mes actual - mismo lenguaje ya aprobado para
   BalanceCard.vue/BalanceTrendBackdrop.vue (halo desenfocado + nucleo con su
   propio drop-shadow), pedido explicito del usuario de que la pantalla de
   Analisis "se sienta viva". Rojo solo cuando el acumulado esta en negativo
   (mismo criterio de color que el resto del componente) - en positivo se
   queda en un brillo blanco neutro, nunca un segundo color de "positivo". */
.cumulative-dot-glow {
  fill: var(--text-h);
  opacity: 0.5;
  filter: blur(3px);
}

.cumulative-dot-glow.negative {
  fill: var(--accent);
}

.cumulative-dot-core {
  fill: var(--text-h);
  filter: drop-shadow(0 0 4px rgba(246, 246, 247, 0.55));
}

.cumulative-dot-core.negative {
  fill: var(--accent);
  filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.95));
}

.cumulative-axis {
  display: flex;
  justify-content: space-between;
  gap: 0.25rem;
}

.cumulative-axis-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-align: center;
  text-transform: capitalize;
}

.cumulative-axis-label:first-child {
  text-align: left;
}

.cumulative-axis-label:last-child {
  text-align: right;
}

.cumulative-empty {
  font-size: 0.8125rem;
  color: var(--text-muted);
}
</style>
