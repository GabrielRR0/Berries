<script setup lang="ts">
import { computed } from 'vue'
import { useListStaggerTransition } from '../../animation/useListStaggerTransition'
import type { TopTransaction } from '../../services/analytics/interfaces/analytics.interface'
import { formatDayMonth } from '../../utils/analytics/periods'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import AnalyticsCard from './AnalyticsCard.vue'

// Los movimientos mas grandes del mes. Reserva 5 filas de alto para que no salte al cargar.
const props = defineProps<{ items: TopTransaction[]; currency: string; ready: boolean; refreshing: boolean }>()
defineEmits<{ viewAll: [] }>()

const rowTransition = useListStaggerTransition()

const rows = computed(() =>
  props.items.map((item, index) => ({
    id: item.id,
    order: index,
    date: formatDayMonth(item.occurredAt),
    title: item.description?.trim() || item.category,
    category: item.category,
    wallet: item.walletName,
    amount: formatCurrency(item.amount, props.currency),
  })),
)
</script>

<template>
  <AnalyticsCard title="Mayores gastos del mes" :ready="ready" :refreshing="refreshing" min-height="22rem">
    <template #actions>
      <button type="button" class="top-link" @click="$emit('viewAll')">Ver todos los movimientos</button>
    </template>

    <p v-if="rows.length === 0" class="top-empty">Todavía no hay gastos registrados este mes.</p>
    <TransitionGroup
      v-else
      tag="ul"
      class="top-list"
      :css="false"
      appear
      @before-enter="rowTransition.onBeforeEnter"
      @enter="rowTransition.onEnter"
      @leave="rowTransition.onLeave"
    >
      <li v-for="row in rows" :key="row.id" class="top-row" :data-order="row.order">
        <span class="top-date">{{ row.date }}</span>
        <span class="top-main">
          <span class="top-title">{{ row.title }}</span>
          <span class="top-meta">
            <span class="top-chip">{{ row.category }}</span>
            <span class="top-wallet">{{ row.wallet }}</span>
          </span>
        </span>
        <b class="top-amount">−{{ row.amount }}</b>
      </li>
    </TransitionGroup>
  </AnalyticsCard>
</template>

<style scoped src="./topTransactionsCard.css"></style>
