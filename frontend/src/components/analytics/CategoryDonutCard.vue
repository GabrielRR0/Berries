<script setup lang="ts">
import { computed, ref } from 'vue'
import { vGrowBar } from '../../animation/vGrowBar'
import type { CategoryBreakdown } from '../../services/analytics/interfaces/analytics.interface'
import { buildDonutSegments, groupSlices, sliceColor } from '../../utils/charts/donut'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import AnalyticsCard from './AnalyticsCard.vue'

// "En que gastas": dona por categoria + ranking. Pasar el cursor por una fila (o enfocarla)
// aisla esa categoria en la dona; tocarla la deja marcada y se resalta tambien en la
// comparativa. Las 5 mayores van por separado y el resto junto en "Otros".
const props = defineProps<{
  breakdown: CategoryBreakdown[]
  currency: string
  selectedCategory: string | null
  ready: boolean
  refreshing: boolean
}>()
const emit = defineEmits<{ select: [category: string] }>()

const hovered = ref<number | null>(null)
const money = (value: number) => formatCurrency(value, props.currency)

const slices = computed(() => groupSlices(props.breakdown))
const grandTotal = computed(() => slices.value.reduce((sum, slice) => sum + slice.total, 0))
const pinnedIndex = computed(() => {
  const index = slices.value.findIndex((slice) => slice.category === props.selectedCategory)
  return index === -1 ? null : index
})
const focusIndex = computed(() => hovered.value ?? pinnedIndex.value)
const segments = computed(() => buildDonutSegments(slices.value, focusIndex.value))

const center = computed(() => {
  const slice = focusIndex.value === null ? null : slices.value[focusIndex.value]
  if (!slice) {
    const count = slices.value.length
    return { label: 'Total gastado', value: money(grandTotal.value), caption: `${count} ${count === 1 ? 'categoría' : 'categorías'}` }
  }
  return { label: slice.category, value: money(slice.total), caption: `${Math.round(slice.percentage)}% del total` }
})

const rows = computed(() =>
  slices.value.map((slice, index) => ({
    index,
    category: slice.category,
    value: money(slice.total),
    percent: `${Math.round(slice.percentage)}%`,
    ratio: slices.value[0]?.total ? slice.total / slices.value[0].total : 0,
    color: sliceColor(index, focusIndex.value),
    dimmed: focusIndex.value !== null && focusIndex.value !== index,
    pinned: index === pinnedIndex.value,
  })),
)
</script>

<template>
  <AnalyticsCard
    title="En qué gastas"
    subtitle="Pasa el cursor por una categoría para aislarla"
    :ready="ready"
    :refreshing="refreshing"
    min-height="26rem"
  >
    <p v-if="slices.length === 0" class="donut-empty">Todavía no registras gastos en este mes.</p>

    <div v-else class="donut-layout">
      <div class="donut" role="img" :aria-label="`Gasto total ${money(grandTotal)} en ${slices.length} categorías`">
        <svg viewBox="0 0 36 36" class="donut-svg" aria-hidden="true">
          <circle class="donut-track" cx="18" cy="18" r="15.9155" />
          <circle
            v-for="segment in segments"
            :key="segment.category"
            class="donut-segment"
            cx="18"
            cy="18"
            r="15.9155"
            :stroke="segment.color"
            :stroke-dasharray="segment.dashArray"
            :stroke-dashoffset="segment.dashOffset"
          />
        </svg>
        <div class="donut-center">
          <span class="donut-center-label">{{ center.label }}</span>
          <b class="donut-center-value">{{ center.value }}</b>
          <span class="donut-center-caption">{{ center.caption }}</span>
        </div>
      </div>

      <ul class="donut-rows" @mouseleave="hovered = null">
        <li v-for="row in rows" :key="row.category">
          <button
            type="button"
            class="donut-row"
            :class="{ dimmed: row.dimmed, pinned: row.pinned }"
            :aria-pressed="row.pinned"
            @mouseenter="hovered = row.index"
            @focus="hovered = row.index"
            @blur="hovered = null"
            @click="emit('select', row.category)"
          >
            <i class="donut-swatch" :style="{ background: row.color }" />
            <span class="donut-name">{{ row.category }}</span>
            <b class="donut-value">{{ row.value }}</b>
            <span class="donut-percent">{{ row.percent }}</span>
            <span class="donut-bar"><span v-grow-bar="row.ratio" class="donut-bar-fill" :style="{ background: row.color }" /></span>
          </button>
        </li>
      </ul>
    </div>
  </AnalyticsCard>
</template>

<style scoped src="./categoryDonutCard.css"></style>
