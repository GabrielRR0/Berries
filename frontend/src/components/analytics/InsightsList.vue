<script setup lang="ts">
import { computed } from 'vue'
import { useListStaggerTransition } from '../../animation/useListStaggerTransition'
import type { Insight } from '../../services/analytics/interfaces/analytics.interface'
import { describeInsight } from '../../utils/analytics/insightTexts'
import SkeletonBlock from '../ui/SkeletonBlock.vue'

// Recomendaciones del mes. Mientras cargan se reservan 4 tarjetas, que es lo habitual,
// para que la lista no empuje al resto de la pagina al llegar.
const props = defineProps<{ insights: Insight[]; currency: string; ready: boolean }>()

const rowTransition = useListStaggerTransition()
const views = computed(() => props.insights.map((insight, index) => ({ key: `${insight.code}-${insight.category ?? index}`, view: describeInsight(insight, props.currency) })))
</script>

<template>
  <section class="insights" aria-label="Recomendaciones">
    <header class="insights-head">
      <h2 class="insights-title">Recomendaciones para ti</h2>
      <span class="insights-hint">Calculadas con tu historial de los últimos 3 meses</span>
    </header>

    <ul v-if="!ready" class="insights-grid" aria-hidden="true">
      <li v-for="n in 4" :key="n" class="insight-placeholder"><SkeletonBlock /></li>
    </ul>
    <TransitionGroup
      v-else
      tag="ul"
      class="insights-grid"
      :css="false"
      appear
      @before-enter="rowTransition.onBeforeEnter"
      @enter="rowTransition.onEnter"
      @leave="rowTransition.onLeave"
    >
      <li v-for="(item, index) in views" :key="item.key" class="insight" :class="item.view.tone" :data-order="index">
        <span class="insight-badge">{{ item.view.badge }}</span>
        <h3 class="insight-title">{{ item.view.title }}</h3>
        <p class="insight-body">{{ item.view.body }}</p>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped src="./insightsList.css"></style>
