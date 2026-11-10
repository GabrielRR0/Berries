<script setup lang="ts">
import type {
  AnalyticsCompareAgainst,
  AnalyticsGranularity,
} from '../../services/analytics/interfaces/analytics.interface'
import { COMPARE_OPTIONS, GRANULARITY_OPTIONS } from '../../utils/analytics/periods'
import MonthPager from '../ui/MonthPager.vue'
import PillToggle from '../ui/PillToggle.vue'

// Barra de controles de Analisis: mes que se analiza, con que se compara y por cuanto
// tiempo se agrupa el grafico de flujo. Solo conecta; el estado vive en useAnalyticsFilters.
defineProps<{
  year: number
  month: number
  granularity: AnalyticsGranularity
  against: AnalyticsCompareAgainst
}>()
const emit = defineEmits<{
  'update:granularity': [value: AnalyticsGranularity]
  'update:against': [value: AnalyticsCompareAgainst]
  changeMonth: [year: number, month: number]
}>()
</script>

<template>
  <div class="analytics-controls">
    <MonthPager :year="year" :month="month" variant="toolbar" @change="(y, m) => emit('changeMonth', y, m)" />

    <div class="analytics-control">
      <span class="analytics-control-label">Comparar con</span>
      <PillToggle
        :options="COMPARE_OPTIONS"
        :model-value="against"
        @update:model-value="emit('update:against', $event as AnalyticsCompareAgainst)"
      />
    </div>

    <div class="analytics-control">
      <span class="analytics-control-label">Gráfico por</span>
      <PillToggle
        :options="GRANULARITY_OPTIONS"
        :model-value="granularity"
        @update:model-value="emit('update:granularity', $event as AnalyticsGranularity)"
      />
    </div>
  </div>
</template>

<style scoped src="./analyticsControls.css"></style>
