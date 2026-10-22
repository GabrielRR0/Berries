<script setup lang="ts">
import { computed } from 'vue'
import { useCollapseTransition } from '../../animation/useCollapseTransition'
import { vGrowBar } from '../../animation/vGrowBar'
import type { CategoryBreakdown } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { toCategorySegments, trimZeroDecimals } from '../../utils/transactions/categorySegments'

// Panel "En qué se fue el mes" (escritorio): barra segmentada + lista de las
// categorias de gasto con su porcentaje y total. Tocar una categoria filtra el
// historial. Recibe el desglose ya calculado por el backend (useAnalytics).
const props = defineProps<{ breakdown: CategoryBreakdown[]; currency: string; selected: string | null }>()
const emit = defineEmits<{ select: [category: string | null] }>()

const { onEnter, onLeave } = useCollapseTransition()
const segments = computed(() => toCategorySegments(props.breakdown))

function select(category: string, isOthers: boolean) {
  if (isOthers) return
  emit('select', props.selected === category ? null : category)
}
</script>

<template>
  <Transition :css="false" @enter="onEnter" @leave="onLeave">
  <section v-if="segments.length > 0" class="breakdown-card">
    <h2 class="breakdown-title">En qué se fue el mes</h2>
    <div v-grow-bar="1" class="breakdown-bar" aria-hidden="true">
      <span
        v-for="segment in segments"
        :key="segment.name"
        class="breakdown-bar-segment"
        :class="`tone-${segment.tone}`"
        :style="{ width: `${segment.percentage}%` }"
      />
    </div>
    <ul class="breakdown-list">
      <li v-for="segment in segments" :key="segment.name">
        <button
          type="button"
          class="breakdown-row"
          :class="{ active: selected === segment.name }"
          :disabled="segment.isOthers"
          @click="select(segment.name, segment.isOthers)"
        >
          <span class="breakdown-swatch" :class="`tone-${segment.tone}`" />
          <span class="breakdown-name">{{ segment.name }}</span>
          <span class="breakdown-share">{{ Math.round(segment.percentage) }}%</span>
          <span class="breakdown-total">{{ trimZeroDecimals(formatCurrency(segment.total, currency)) }}</span>
        </button>
      </li>
    </ul>
  </section>
  </Transition>
</template>

<style scoped src="./categoryBreakdownCard.css"></style>
