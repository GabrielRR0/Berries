<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDrawLine } from '../../animation/useDrawLine'
import type { Timeline } from '../../services/analytics/interfaces/analytics.interface'
import { bucketLabel, bucketLongLabel } from '../../utils/analytics/periods'
import { buildSeriesGeometry } from '../../utils/charts/seriesPath'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import AnalyticsCard from './AnalyticsCard.vue'

// Ahorro acumulado: la suma corrida de (ingresos - gastos) mes a mes en los ultimos 6 meses.
// El eje siempre incluye el cero, asi un mes en negativo se ve por debajo de la linea.
const props = defineProps<{ history: Timeline | null; currency: string; ready: boolean; refreshing: boolean }>()

const VIEW = { width: 600, height: 200, padX: 24, padTop: 18, padBottom: 18 }

const buckets = computed(() => props.history?.buckets ?? [])
const cumulative = computed(() => {
  let running = 0
  return buckets.value.map((bucket) => (running += bucket.net))
})
const geometry = computed(() => buildSeriesGeometry(cumulative.value, VIEW))
const money = (value: number) => formatCurrency(value, props.currency)

const line = ref<SVGPathElement | null>(null)
const area = ref<SVGPathElement | null>(null)
useDrawLine(line, area, () => cumulative.value.join(','))

const points = computed(() =>
  geometry.value.points.map(([x, y], index) => ({
    x,
    y,
    isLast: index === geometry.value.points.length - 1,
    title: `${bucketLongLabel(buckets.value[index].start, 'month')}: acumulado ${money(cumulative.value[index])}`,
  })),
)

const labels = computed(() => buckets.value.map((bucket) => bucketLabel(bucket.start, 'month')))
const labelInset = computed(() => ({
  paddingLeft: `${(VIEW.padX / VIEW.width) * 100}%`,
  paddingRight: `${(VIEW.padX / VIEW.width) * 100}%`,
}))

const stats = computed(() => {
  const nets = buckets.value.map((bucket, index) => ({ net: bucket.net, label: bucketLongLabel(bucket.start, 'month', new Date(2000, 0, 1)).replace(' · en curso', ''), index }))
  if (nets.length === 0) return []
  const best = nets.reduce((a, b) => (b.net > a.net ? b : a))
  const worst = nets.reduce((a, b) => (b.net < a.net ? b : a))
  const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value))}`
  return [
    { label: 'Acumulado', value: money(cumulative.value[cumulative.value.length - 1] ?? 0), hint: `${nets.length} meses` },
    { label: 'Mejor mes', value: signed(best.net), hint: best.label },
    { label: 'Mes más flojo', value: signed(worst.net), hint: worst.label },
  ]
})
</script>

<template>
  <AnalyticsCard
    title="Ahorro acumulado"
    subtitle="Ingresos menos gastos, sumados mes a mes"
    :ready="ready"
    :refreshing="refreshing"
    min-height="22rem"
  >
    <div class="savings">
      <div class="savings-chart">
        <svg
          class="savings-svg"
          :viewBox="`0 0 ${VIEW.width} ${VIEW.height}`"
          role="img"
          aria-label="Curva de ahorro acumulado de los últimos meses"
        >
          <defs>
            <linearGradient id="savings-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" class="savings-stop-top" />
              <stop offset="1" class="savings-stop-bottom" />
            </linearGradient>
          </defs>
          <line class="savings-zero" :x1="VIEW.padX" :x2="VIEW.width - VIEW.padX" :y1="geometry.zeroY" :y2="geometry.zeroY" />
          <path ref="area" class="savings-area" :d="geometry.areaPath" fill="url(#savings-fill)" />
          <path ref="line" class="savings-line" :d="geometry.linePath" />
          <g v-for="point in points" :key="point.x">
            <circle v-if="point.isLast" class="savings-glow" :cx="point.x" :cy="point.y" r="10" />
            <circle class="savings-dot" :class="{ last: point.isLast }" :cx="point.x" :cy="point.y" :r="point.isLast ? 5.5 : 4">
              <title>{{ point.title }}</title>
            </circle>
          </g>
        </svg>
        <ul class="savings-labels" :style="labelInset" aria-hidden="true">
          <li v-for="(label, index) in labels" :key="index">{{ label }}</li>
        </ul>
      </div>

      <ul class="savings-stats">
        <li v-for="stat in stats" :key="stat.label" class="savings-stat">
          <span class="savings-stat-label">{{ stat.label }}</span>
          <b class="savings-stat-value">{{ stat.value }}</b>
          <span class="savings-stat-hint">{{ stat.hint }}</span>
        </li>
      </ul>
    </div>
  </AnalyticsCard>
</template>

<style scoped src="./savingsCurveCard.css"></style>
