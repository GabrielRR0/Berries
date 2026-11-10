<script setup lang="ts">
import { computed } from 'vue'
import { useListStaggerTransition } from '../../animation/useListStaggerTransition'
import { vGrowBar } from '../../animation/vGrowBar'
import type { SpendingPatterns } from '../../services/analytics/interfaces/analytics.interface'
import {
  formatDayMonth,
  WEEKDAY_LETTERS_MONDAY_FIRST,
  WEEKDAY_NAMES_MONDAY_FIRST,
} from '../../utils/analytics/periods'
import { buildHeatGrid, buildWeekdayBars } from '../../utils/charts/heatmap'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import AnalyticsCard from './AnalyticsCard.vue'

// "Cuando gastas": mapa de calor de las ultimas semanas (una columna por semana, una fila por
// dia de lunes a domingo), promedio por dia de la semana y cuanto del gasto cae en fin de
// semana. Es independiente del mes elegido: siempre mira hasta hoy.
const props = defineProps<{ patterns: SpendingPatterns | null; currency: string; ready: boolean; refreshing: boolean }>()

const cellTransition = useListStaggerTransition()
const money = (value: number) => formatCurrency(value, props.currency)

const cells = computed(() => {
  const patterns = props.patterns
  if (!patterns) return []
  return buildHeatGrid(patterns.heat, patterns.weeks).map((cell, index) => ({
    key: index,
    order: Math.floor(index / 7),
    empty: cell.empty,
    background: cell.empty ? 'transparent' : `rgba(var(--accent-rgb), ${(0.07 + 0.88 * cell.level).toFixed(2)})`,
    label: cell.empty ? 'Aún no ocurre' : `${formatDayMonth(cell.day)}: ${money(cell.total)}`,
  }))
})

const weekLabels = computed(() => {
  const patterns = props.patterns
  if (!patterns) return []
  return Array.from({ length: patterns.weeks }, (_, week) => {
    const cell = patterns.heat[week * 7]
    return cell ? formatDayMonth(cell.day) : ''
  })
})

const bars = computed(() =>
  buildWeekdayBars(props.patterns?.weekdayAverages ?? []).map((bar) => ({
    letter: WEEKDAY_LETTERS_MONDAY_FIRST[bar.weekday],
    ratio: bar.ratio,
    value: money(bar.average),
    isPeak: bar.isPeak,
  })),
)

const weekendPercent = computed(() => Math.round((props.patterns?.weekendShare ?? 0) * 100))
const summary = computed(() => {
  const patterns = props.patterns
  if (!patterns || patterns.busiestWeekday === null) return 'Cuando registres gastos verás aquí en qué días se concentran.'
  const day = WEEKDAY_NAMES_MONDAY_FIRST[patterns.busiestWeekday]
  const peak = patterns.weekdayAverages.find((item) => item.weekday === patterns.busiestWeekday)
  return `El ${day} es tu día más caro: ${money(peak?.average ?? 0)} en promedio.`
})
</script>

<template>
  <AnalyticsCard
    title="Cuándo gastas"
    :subtitle="`Intensidad por día, últimas ${patterns?.weeks ?? 8} semanas`"
    :ready="ready"
    :refreshing="refreshing"
    min-height="26rem"
  >
    <div class="patterns">
      <div class="patterns-top">
        <div class="heat">
          <ul class="heat-weekdays" aria-hidden="true">
            <li v-for="letter in WEEKDAY_LETTERS_MONDAY_FIRST" :key="letter">{{ letter }}</li>
          </ul>
          <div class="heat-main">
            <TransitionGroup
              tag="div"
              class="heat-grid"
              :css="false"
              appear
              @before-enter="cellTransition.onBeforeEnter"
              @enter="cellTransition.onEnter"
              @leave="cellTransition.onLeave"
            >
              <span
                v-for="cell in cells"
                :key="cell.key"
                class="heat-cell"
                :class="{ empty: cell.empty }"
                :style="{ background: cell.background }"
                :title="cell.label"
                :data-order="cell.order"
              />
            </TransitionGroup>
            <ul class="heat-weeks" aria-hidden="true">
              <li v-for="(label, index) in weekLabels" :key="index">{{ label }}</li>
            </ul>
          </div>
        </div>

        <ul class="weekday-bars">
          <li v-for="bar in bars" :key="bar.letter" class="weekday-bar" :class="{ peak: bar.isPeak }">
            <span class="weekday-letter">{{ bar.letter }}</span>
            <span class="weekday-track"><span v-grow-bar="bar.ratio" class="weekday-fill" /></span>
            <b class="weekday-value">{{ bar.value }}</b>
          </li>
        </ul>
      </div>

      <div class="weekend">
        <div class="weekend-captions"><span>Entre semana</span><span>Fin de semana</span></div>
        <div
          class="weekend-bar"
          role="img"
          :aria-label="`${100 - weekendPercent}% del gasto entre semana y ${weekendPercent}% el fin de semana`"
        >
          <span class="weekend-part weekdays" :style="{ flexGrow: Math.max(1, 100 - weekendPercent) }" />
          <span class="weekend-part weekends" :style="{ flexGrow: Math.max(1, weekendPercent) }" />
        </div>
        <div class="weekend-figures">
          <b>{{ 100 - weekendPercent }}% del gasto</b>
          <b class="accent">{{ weekendPercent }}% del gasto</b>
        </div>
      </div>

      <p class="patterns-summary">{{ summary }}</p>
    </div>
  </AnalyticsCard>
</template>

<style scoped src="./spendingHeatmap.css"></style>
