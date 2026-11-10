<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStaggerReveal } from '../../animation/useStaggerReveal'
import { useAnalyticsDashboard } from '../../composables/analytics/useAnalyticsDashboard'
import { useAnalyticsFilters } from '../../composables/analytics/useAnalyticsFilters'
import { useAuthStore } from '../../stores/auth.store'
import { useWalletsStore } from '../../stores/wallets.store'
import { buildKpiTiles } from '../../utils/analytics/kpis'
import { buildPace } from '../../utils/analytics/pace'
import { isCurrentMonth } from '../../utils/analytics/periods'
import { formatMonthYear } from '../../utils/formatters/formatDate'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import StatTiles from '../ui/StatTiles.vue'
import AnalyticsCard from './AnalyticsCard.vue'
import AnalyticsControls from './AnalyticsControls.vue'
import AnalyticsHero from './AnalyticsHero.vue'
import CategoryDonutCard from './CategoryDonutCard.vue'
import CategoryMonthlyTrendChart from './CategoryMonthlyTrendChart.vue'
import ComparisonPanel from './ComparisonPanel.vue'
import FlowChart from './FlowChart.vue'
import InsightsList from './InsightsList.vue'
import SavingsCurveCard from './SavingsCurveCard.vue'
import SpendingHeatmap from './SpendingHeatmap.vue'
import TopTransactionsCard from './TopTransactionsCard.vue'
import WalletBreakdownCard from './WalletBreakdownCard.vue'

// Pantalla "Análisis" (/analitica). Solo conecta: los filtros viven en useAnalyticsFilters, los
// datos en useAnalyticsDashboard y cada bloque es su propio componente. Todos los montos
// llegan ya convertidos a la moneda por defecto del usuario (ver backend analytics).
const router = useRouter()
const authStore = useAuthStore()
const walletsStore = useWalletsStore()

const filters = useAnalyticsFilters()
const dashboard = useAnalyticsDashboard(filters)

const showHelpSheet = ref(false)
const root = ref<HTMLElement | null>(null)
useStaggerReveal(root, { spring: true, rise: 12, step: 0.06 })

const currency = computed(() => authStore.user?.defaultCurrency ?? 'USD')
const monthLabel = computed(() => formatMonthYear(filters.year.value, filters.month.value).toLowerCase())

const daysInMonth = computed(() => new Date(filters.year.value, filters.month.value + 1, 0).getDate())
// Los días transcurridos los fija el backend (fecha UTC) cuando ya respondió, para que el
// hero y la comparativa hablen del mismo tramo aunque el reloj local ya cruzara medianoche.
const elapsedDays = computed(() => {
  const comparison = dashboard.comparison.data.value
  if (comparison && comparison.period === filters.monthKey.value) return comparison.elapsedDays
  return isCurrentMonth(filters.year.value, filters.month.value) ? new Date().getDate() : daysInMonth.value
})

// Meses anteriores al elegido (de los 6 que trae el historial): base del promedio del ritmo.
const priorExpenses = computed(() =>
  (dashboard.history.data.value?.buckets ?? []).slice(0, -1).slice(-3).map((bucket) => bucket.totalExpense),
)

const pace = computed(() =>
  buildPace({
    spent: dashboard.summary.data.value?.totalExpense ?? 0,
    elapsedDays: elapsedDays.value,
    daysInMonth: daysInMonth.value,
    priorExpenses: priorExpenses.value,
  }),
)

const kpiTiles = computed(() =>
  buildKpiTiles({
    summary: dashboard.summary.data.value,
    elapsedDays: elapsedDays.value,
    movementCount: dashboard.history.data.value ? (dashboard.history.data.value.buckets.at(-1)?.count ?? 0) : null,
    topCategory: dashboard.categories.data.value ? (dashboard.categories.data.value[0] ?? null) : undefined,
    biggest: dashboard.top.data.value ? (dashboard.top.data.value[0] ?? null) : undefined,
    currency: currency.value,
  }),
)

function goBack() {
  router.push({ name: 'dashboard' })
}

function openMovements() {
  router.push({ name: 'movimientos' })
}

onMounted(() => {
  walletsStore.fetchWallets()
})
</script>

<template>
  <PageShell>
    <SectionHeader title="Análisis" max-width="68rem" @back="goBack" @help="showHelpSheet = true" />

    <div ref="root" class="analytics-screen">
      <AnalyticsControls
        v-model:granularity="filters.granularity.value"
        v-model:against="filters.against.value"
        class="cell-full"
        data-reveal
        :year="filters.year.value"
        :month="filters.month.value"
        @change-month="filters.setMonth"
      />

      <div v-if="dashboard.error.value" class="analytics-error cell-full" role="alert">
        <span>{{ dashboard.error.value }}</span>
        <button type="button" class="analytics-retry" @click="dashboard.reload()">Reintentar</button>
      </div>

      <AnalyticsHero
        class="cell-hero"
        data-reveal
        :pace="pace"
        :currency="currency"
        :month-label="monthLabel"
        :elapsed-days="elapsedDays"
        :days-in-month="daysInMonth"
        :delta-percent="dashboard.comparison.data.value?.deltaPercent ?? null"
        :against="filters.against.value"
      />
      <StatTiles class="cell-kpis" data-reveal compact :tiles="kpiTiles" />

      <InsightsList
        class="cell-full"
        data-reveal
        :insights="dashboard.insights.data.value ?? []"
        :currency="currency"
        :ready="dashboard.insights.data.value !== null"
      />

      <FlowChart
        class="cell-flow"
        data-reveal
        :buckets="dashboard.flow.data.value?.buckets ?? []"
        :granularity="filters.granularity.value"
        :currency="currency"
        :wallets="walletsStore.wallets"
        :wallet-id="filters.walletId.value"
        :ready="dashboard.flow.data.value !== null"
        :refreshing="dashboard.flow.isLoading.value"
        @update:wallet-id="filters.walletId.value = $event"
      />
      <ComparisonPanel
        class="cell-compare"
        data-reveal
        :comparison="dashboard.comparison.data.value"
        :currency="currency"
        :selected-category="filters.selectedCategory.value"
        :ready="dashboard.comparison.data.value !== null"
        :refreshing="dashboard.comparison.isLoading.value"
        @select="filters.toggleCategory"
      />

      <CategoryDonutCard
        class="cell-half"
        data-reveal
        :breakdown="dashboard.categories.data.value ?? []"
        :currency="currency"
        :selected-category="filters.selectedCategory.value"
        :ready="dashboard.categories.data.value !== null"
        :refreshing="dashboard.categories.isLoading.value"
        @select="filters.toggleCategory"
      />
      <SpendingHeatmap
        class="cell-half"
        data-reveal
        :patterns="dashboard.patterns.data.value"
        :currency="currency"
        :ready="dashboard.patterns.data.value !== null"
        :refreshing="dashboard.patterns.isLoading.value"
      />

      <SavingsCurveCard
        class="cell-flow"
        data-reveal
        :history="dashboard.history.data.value"
        :currency="currency"
        :ready="dashboard.history.data.value !== null"
        :refreshing="dashboard.history.isLoading.value"
      />
      <WalletBreakdownCard
        class="cell-compare"
        data-reveal
        :items="dashboard.wallets.data.value ?? []"
        :currency="currency"
        :ready="dashboard.wallets.data.value !== null"
        :refreshing="dashboard.wallets.isLoading.value"
      />

      <AnalyticsCard
        class="cell-half"
        data-reveal
        title="Tendencia por categoría"
        subtitle="Cuánto gastas en cada una, mes a mes"
        :ready="dashboard.trend.data.value !== null"
        :refreshing="dashboard.trend.isLoading.value"
        min-height="22rem"
      >
        <CategoryMonthlyTrendChart :trend="dashboard.trend.data.value" type="expense" :currency="currency" />
      </AnalyticsCard>
      <TopTransactionsCard
        class="cell-half"
        data-reveal
        :items="dashboard.top.data.value ?? []"
        :currency="currency"
        :ready="dashboard.top.data.value !== null"
        :refreshing="dashboard.top.isLoading.value"
        @view-all="openMovements"
      />
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Análisis?" @close="showHelpSheet = false">
      <p class="help-text">
        Aquí ves cómo te está yendo con tu plata: cuánto llevas gastado frente a tu ritmo habitual, cómo cambia por
        día, semana o mes, en qué categorías y billeteras se va, qué días gastas más y cuánto ahorras acumulado. Las
        recomendaciones salen de comparar tu mes con tu propio historial. Todo se calcula solo con los movimientos que
        ya registraste: no hay nada que cargar a mano acá.
      </p>
    </BottomSheet>
  </PageShell>
</template>

<style scoped src="./analytics.css"></style>
