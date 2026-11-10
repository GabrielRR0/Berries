<script setup lang="ts">
import { computed } from 'vue'
import { vGrowBar } from '../../animation/vGrowBar'
import type { AnalyticsCompareAgainst } from '../../services/analytics/interfaces/analytics.interface'
import type { PaceSummary } from '../../utils/analytics/pace'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'

// Resumen principal del mes: cuanto va gastado, cuanto "tocaria" a esta altura segun el
// promedio de los meses anteriores y a donde llega al cierre si sigue igual.
const props = defineProps<{
  pace: PaceSummary
  currency: string
  monthLabel: string
  elapsedDays: number
  daysInMonth: number
  deltaPercent: number | null
  against: AnalyticsCompareAgainst
}>()

const AGAINST_LABEL: Record<AnalyticsCompareAgainst, string> = {
  previous: 'el mes anterior',
  year_ago: 'el año pasado',
  average: 'tu promedio',
}

const money = (value: number) => formatCurrency(value, props.currency)

const eyebrow = computed(() =>
  props.pace.isClosed
    ? `Gastado en ${props.monthLabel}`
    : `Gastado en ${props.monthLabel} · día ${props.elapsedDays} de ${props.daysInMonth}`,
)

const deltaText = computed(() => {
  if (props.deltaPercent === null) return 'Sin base de comparación'
  const rounded = Math.round(props.deltaPercent)
  return `${rounded > 0 ? '+' : ''}${rounded}% vs ${AGAINST_LABEL[props.against]}`
})
const deltaIsUp = computed(() => props.deltaPercent !== null && Math.round(props.deltaPercent) > 0)

const paceLine = computed(() => {
  if (!props.pace.hasAverage) return 'Aún no hay un promedio: necesitamos al menos un mes anterior con gastos.'
  const gap = money(Math.abs(props.pace.overPace))
  if (props.pace.isClosed) return `Promedio de tus meses anteriores: ${money(props.pace.average)}`
  return props.pace.overPace > 0 ? `Vas ${gap} por encima del ritmo` : `Vas ${gap} por debajo del ritmo`
})
const paceIsOver = computed(() => props.pace.hasAverage && !props.pace.isClosed && props.pace.overPace > 0)

const tiles = computed(() => {
  const { pace } = props
  const diff = pace.projectedDiff
  return [
    { label: pace.isClosed ? 'Cierre del mes' : 'Proyección de cierre', value: money(pace.projected), hot: false },
    { label: 'Promedio de meses anteriores', value: pace.hasAverage ? money(pace.average) : '—', hot: false },
    {
      label: 'Diferencia con el promedio',
      value: pace.hasAverage ? `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${money(Math.abs(diff))}` : '—',
      hot: pace.hasAverage && diff > 0,
    },
  ]
})
</script>

<template>
  <section class="hero" aria-label="Resumen de gasto del mes">
    <div class="hero-top">
      <p class="hero-eyebrow">{{ eyebrow }}</p>
      <span class="hero-chip" :class="{ hot: deltaIsUp }">{{ deltaText }}</span>
    </div>

    <AnimatedCurrency class="hero-amount" :value="pace.spent" :currency="currency" direction="down" />

    <div class="hero-pace">
      <div
        class="hero-track"
        role="img"
        :aria-label="`Gastado ${Math.round(pace.fillRatio * 100)}% del promedio mensual`"
      >
        <div v-grow-bar="pace.fillRatio" class="hero-fill" />
        <span v-if="pace.hasAverage && !pace.isClosed" class="hero-marker" :style="{ left: `${pace.markerRatio * 100}%` }" />
      </div>
      <p class="hero-pace-line" :class="{ hot: paceIsOver }">{{ paceLine }}</p>
    </div>

    <ul class="hero-tiles">
      <li v-for="tile in tiles" :key="tile.label" class="hero-tile">
        <span class="hero-tile-label">{{ tile.label }}</span>
        <b class="hero-tile-value" :class="{ hot: tile.hot }">{{ tile.value }}</b>
      </li>
    </ul>
  </section>
</template>

<style scoped src="./analyticsHero.css"></style>
