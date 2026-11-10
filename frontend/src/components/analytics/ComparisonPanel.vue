<script setup lang="ts">
import { computed } from 'vue'
import { vGrowBar } from '../../animation/vGrowBar'
import type { AnalyticsCompareAgainst, PeriodComparison } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import AnalyticsCard from './AnalyticsCard.vue'

// Este tramo del mes contra el mismo tramo de otro periodo, categoria por categoria. La
// barra gruesa es lo de ahora, la fina gris lo de antes. Las subidas fuertes llevan el acento.
const props = defineProps<{
  comparison: PeriodComparison | null
  currency: string
  selectedCategory: string | null
  ready: boolean
  refreshing: boolean
}>()
const emit = defineEmits<{ select: [category: string] }>()

const HOT_PERCENT = 25
const MAX_ROWS = 6

const AGAINST_CAPTION: Record<AnalyticsCompareAgainst, string> = {
  previous: 'el mismo tramo del mes anterior',
  year_ago: 'el mismo tramo del año pasado',
  average: 'el promedio de los 3 meses anteriores',
}

const money = (value: number) => formatCurrency(value, props.currency)

function deltaLabel(current: number, previous: number, percent: number | null): string {
  if (percent !== null) return `${percent > 0 ? '+' : percent < 0 ? '−' : ''}${Math.abs(Math.round(percent))}%`
  return current > 0 && previous === 0 ? 'Nuevo' : '—'
}

const subtitle = computed(() => {
  const c = props.comparison
  if (!c) return ''
  const range = c.elapsedDays === 1 ? 'Día 1' : `Días 1–${c.elapsedDays}`
  return `${range} · frente a ${AGAINST_CAPTION[c.against]}`
})

const maxValue = computed(() =>
  Math.max(1, ...(props.comparison?.categories ?? []).flatMap((item) => [item.current, item.previous])),
)

const rows = computed(() =>
  (props.comparison?.categories ?? []).slice(0, MAX_ROWS).map((item) => ({
    category: item.category,
    current: money(item.current),
    delta: deltaLabel(item.current, item.previous, item.deltaPercent),
    hot: item.deltaPercent !== null && item.deltaPercent >= HOT_PERCENT,
    currentRatio: item.current / maxValue.value,
    previousRatio: item.previous / maxValue.value,
    previousText: money(item.previous),
    selected: item.category === props.selectedCategory,
    dimmed: props.selectedCategory !== null && item.category !== props.selectedCategory,
  })),
)

const total = computed(() => {
  const c = props.comparison
  if (!c) return null
  return {
    current: money(c.currentTotal),
    previous: money(c.previousTotal),
    delta: deltaLabel(c.currentTotal, c.previousTotal, c.deltaPercent),
    hot: c.deltaPercent !== null && c.deltaPercent >= HOT_PERCENT,
  }
})
</script>

<template>
  <AnalyticsCard
    title="Comparativa por categoría"
    :subtitle="subtitle"
    :ready="ready"
    :refreshing="refreshing"
    min-height="30rem"
  >
    <div v-if="total" class="compare-total">
      <div>
        <span class="compare-total-label">Gasto del tramo</span>
        <b class="compare-total-value">{{ total.current }}</b>
      </div>
      <div class="compare-total-side">
        <span class="compare-delta" :class="{ hot: total.hot }">{{ total.delta }}</span>
        <span class="compare-total-before">antes {{ total.previous }}</span>
      </div>
    </div>

    <p v-if="ready && rows.length === 0" class="compare-empty">Todavía no hay gastos en este tramo para comparar.</p>

    <ul class="compare-list">
      <li v-for="row in rows" :key="row.category">
        <button
          type="button"
          class="compare-row"
          :class="{ selected: row.selected, dimmed: row.dimmed }"
          :aria-pressed="row.selected"
          @click="emit('select', row.category)"
        >
          <span class="compare-line">
            <span class="compare-name">{{ row.category }}</span>
            <span class="compare-figures">
              <b>{{ row.current }}</b>
              <span class="compare-delta" :class="{ hot: row.hot }">{{ row.delta }}</span>
            </span>
          </span>
          <span class="compare-track now"><span v-grow-bar="row.currentRatio" class="compare-bar" :class="{ hot: row.hot }" /></span>
          <span class="compare-track before" :title="`Antes: ${row.previousText}`"><span v-grow-bar="row.previousRatio" class="compare-bar" /></span>
        </button>
      </li>
    </ul>

    <p class="compare-note">Barra gruesa: ahora. Barra fina gris: antes.</p>
  </AnalyticsCard>
</template>

<style scoped src="./comparisonPanel.css"></style>
