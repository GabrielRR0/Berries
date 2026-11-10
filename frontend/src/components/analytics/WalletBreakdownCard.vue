<script setup lang="ts">
import { computed } from 'vue'
import { vGrowBar } from '../../animation/vGrowBar'
import type { WalletBreakdownItem } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import AnalyticsCard from './AnalyticsCard.vue'

// Gasto del mes repartido por billetera. Los montos ya vienen convertidos a la moneda del
// usuario; la etiqueta chica es la moneda propia de cada billetera.
const props = defineProps<{ items: WalletBreakdownItem[]; currency: string; ready: boolean; refreshing: boolean }>()

const rows = computed(() => {
  const max = Math.max(1, ...props.items.map((item) => item.total))
  return props.items.map((item) => ({
    id: item.walletId,
    name: item.name,
    currency: item.currency,
    value: formatCurrency(item.total, props.currency),
    ratio: item.total / max,
    detail: `${Math.round(item.percentage)}% del gasto · ${item.count} ${item.count === 1 ? 'movimiento' : 'movimientos'}`,
  }))
})
</script>

<template>
  <AnalyticsCard
    title="Por billetera"
    subtitle="Gasto del mes en cada una"
    :ready="ready"
    :refreshing="refreshing"
    min-height="20rem"
  >
    <p v-if="rows.length === 0" class="wallet-empty">Todavía no hay gastos en tus billeteras este mes.</p>
    <ul v-else class="wallet-list">
      <li v-for="row in rows" :key="row.id" class="wallet-row">
        <div class="wallet-line">
          <span class="wallet-name">
            {{ row.name }}
            <span v-if="row.currency" class="wallet-currency">{{ row.currency }}</span>
          </span>
          <b class="wallet-value">{{ row.value }}</b>
        </div>
        <span class="wallet-track"><span v-grow-bar="row.ratio" class="wallet-fill" /></span>
        <small class="wallet-detail">{{ row.detail }}</small>
      </li>
    </ul>
    <p v-if="rows.length" class="wallet-note">Cada movimiento usa la tasa del día en que ocurrió.</p>
  </AnalyticsCard>
</template>

<style scoped src="./walletBreakdownCard.css"></style>
