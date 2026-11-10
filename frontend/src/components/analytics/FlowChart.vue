<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { vGrowColumn } from '../../animation/vGrowColumn'
import type { AnalyticsGranularity, TimelineBucket } from '../../services/analytics/interfaces/analytics.interface'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { bucketLabel, bucketLongLabel, granularityCaption, isBucketInProgress } from '../../utils/analytics/periods'
import { buildBarScale } from '../../utils/charts/barChart'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import AnalyticsCard from './AnalyticsCard.vue'

// Grafico de flujo: gasto (y en vista mensual tambien ingreso) por dia, semana o mes. Cada
// barra es un boton: al pasar el cursor, enfocarla con teclado o tocarla, la lectura de
// arriba muestra el detalle de ese periodo. La linea punteada es el promedio de los
// periodos ya completos.
const props = defineProps<{
  buckets: TimelineBucket[]
  granularity: AnalyticsGranularity
  currency: string
  wallets: Wallet[]
  walletId: string | null
  ready: boolean
  refreshing: boolean
}>()
const emit = defineEmits<{ 'update:walletId': [value: string | null] }>()

const hovered = ref<number | null>(null)
watch(
  () => [props.granularity, props.buckets],
  () => {
    hovered.value = null
  },
)

const money = (value: number) => formatCurrency(value, props.currency)
const showIncome = computed(() => props.granularity === 'month')
const scale = computed(() => buildBarScale(props.buckets, showIncome.value))
// Sin cursor encima se muestra el ultimo periodo COMPLETO: el que esta en curso apenas empieza
// y compararlo con el promedio engaña.
const defaultIndex = computed(() => {
  const last = props.buckets.length - 1
  return last > 0 && isBucketInProgress(props.buckets[last].start, props.granularity) ? last - 1 : last
})
const activeIndex = computed(() => hovered.value ?? defaultIndex.value)

const columns = computed(() =>
  props.buckets.map((bucket, index) => ({
    key: bucket.start,
    label: bucketLabel(bucket.start, props.granularity),
    aria: `${bucketLongLabel(bucket.start, props.granularity)}: gastos ${money(bucket.totalExpense)}`,
    expenseRatio: scale.value.bars[index]?.expenseRatio ?? 0,
    incomeRatio: scale.value.bars[index]?.incomeRatio ?? 0,
    inProgress: isBucketInProgress(bucket.start, props.granularity),
    active: index === activeIndex.value,
    delay: Math.min(index * 0.03, 0.5),
  })),
)

const readout = computed(() => {
  const bucket = props.buckets[activeIndex.value]
  if (!bucket) return null
  const diff = bucket.totalExpense - scale.value.average
  const percent = scale.value.average > 0 ? Math.round((diff / scale.value.average) * 100) : null
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : ''
  return {
    label: bucketLongLabel(bucket.start, props.granularity),
    expense: money(bucket.totalExpense),
    income: money(bucket.totalIncome),
    vsAverage: isBucketInProgress(bucket.start, props.granularity)
      ? 'En curso'
      : scale.value.average > 0 ? `${sign}${money(Math.abs(diff))}${percent === null ? '' : ` (${sign}${Math.abs(percent)}%)`}` : '—',
  }
})

function onWalletChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update:walletId', value === '' ? null : value)
}
</script>

<template>
  <AnalyticsCard
    title="Flujo en el tiempo"
    :subtitle="`${granularityCaption(granularity)} · pasa el cursor o toca una barra`"
    :ready="ready"
    :refreshing="refreshing"
    min-height="30rem"
  >
    <template #actions>
      <select class="flow-select" aria-label="Filtrar por billetera" :value="walletId ?? ''" @change="onWalletChange">
        <option value="">Todas las billeteras</option>
        <option v-for="wallet in wallets" :key="wallet.id" :value="wallet.id">{{ wallet.name }}</option>
      </select>
    </template>

    <div class="flow">
      <dl v-if="readout" class="flow-readout" aria-live="polite">
        <div>
          <dt>Período</dt>
          <dd>{{ readout.label }}</dd>
        </div>
        <div>
          <dt>Gastos</dt>
          <dd class="accent">{{ readout.expense }}</dd>
        </div>
        <div>
          <dt>Ingresos</dt>
          <dd>{{ readout.income }}</dd>
        </div>
        <div>
          <dt>Frente al promedio</dt>
          <dd>{{ readout.vsAverage }}</dd>
        </div>
      </dl>

      <ul class="flow-legend">
        <li><i class="flow-key expense" />Gastos</li>
        <li v-if="showIncome"><i class="flow-key income" />Ingresos</li>
        <li><i class="flow-key average" />Promedio</li>
      </ul>

      <div class="flow-plot" @mouseleave="hovered = null">
        <span
          class="flow-average"
          :style="{ bottom: `${scale.averageRatio * 100}%` }"
          aria-hidden="true"
        />
        <div class="flow-columns">
          <button
            v-for="(column, index) in columns"
            :key="column.key"
            type="button"
            class="flow-column"
            :class="{ active: column.active }"
            :aria-label="column.aria"
            @mouseenter="hovered = index"
            @focus="hovered = index"
            @click="hovered = index"
          >
            <span class="flow-pair">
              <span
                v-grow-column="column.expenseRatio"
                class="flow-bar expense"
                :class="{ progress: column.inProgress }"
                :data-grow-delay="column.delay"
              />
              <span
                v-if="showIncome"
                v-grow-column="column.incomeRatio"
                class="flow-bar income"
                :data-grow-delay="column.delay"
              />
            </span>
          </button>
        </div>
      </div>

      <ul class="flow-labels" aria-hidden="true">
        <li v-for="(column, index) in columns" :key="column.key" :class="{ active: index === activeIndex }">
          {{ column.label }}
        </li>
      </ul>

      <p class="flow-note">
        {{ showIncome ? 'Ingresos y gastos comparten la misma escala.' : 'La escala sigue al gasto; los ingresos aparecen en la lectura de arriba.' }}
        Las barras rayadas son el período en curso.
      </p>
    </div>
  </AnalyticsCard>
</template>

<style scoped src="./flowChart.css"></style>
