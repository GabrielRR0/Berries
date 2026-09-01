<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAnalytics } from '../../composables/analytics/useAnalytics'
import type { AnalyticsCategoryType } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import PageShell from '../layout/PageShell.vue'
import BaseCard from '../ui/BaseCard.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import CategoryPieChart from './CategoryPieChart.vue'
import MonthlyComparisonTable from './MonthlyComparisonTable.vue'

// Pantalla "Análisis", ruteada en /analitica (ver router/index.ts - cambio
// reportado, no aplicado aca directo por los limites del trabajo). El
// contrato de /api/analytics no manda moneda (ver contrato del backend en
// el plan) asi que se usa 'USD' como default, igual que BalanceCard.vue/
// IncomeExpenseSummary.vue.
const {
  periodSummary,
  categoryBreakdown,
  monthlyComparison,
  isLoadingSummary,
  isLoadingCategories,
  isLoadingMonthly,
  error,
  fetchPeriodSummary,
  fetchCategoryBreakdown,
  fetchMonthlyComparison,
} = useAnalytics()

const categoryType = ref<AnalyticsCategoryType>('expense')

const netDelta = computed(() => {
  if (!periodSummary.value) return 0
  return periodSummary.value.netSavings - periodSummary.value.previousPeriodNetSavings
})

const netDeltaLabel = computed(() => {
  if (!periodSummary.value) return ''
  const sign = netDelta.value > 0 ? '+' : ''
  return `${sign}${formatCurrency(netDelta.value, 'USD')} vs mes anterior`
})

async function onCategoryTypeChange(type: AnalyticsCategoryType) {
  categoryType.value = type
  await fetchCategoryBreakdown(type)
}

onMounted(() => {
  fetchPeriodSummary()
  fetchCategoryBreakdown(categoryType.value)
  fetchMonthlyComparison(6)
})
</script>

<template>
  <PageShell>
    <div class="analytics-screen">
      <h1 class="analytics-title">Análisis</h1>

      <BaseCard class="summary-card">
        <p class="summary-period">{{ periodSummary?.period ?? '—' }}</p>

        <div class="summary-grid">
          <div class="summary-item">
            <p class="summary-label">Ingresos</p>
            <p class="summary-value">{{ formatCurrency(periodSummary?.totalIncome ?? 0, 'USD') }}</p>
          </div>
          <div class="summary-item">
            <p class="summary-label">Gastos</p>
            <p class="summary-value expense">{{ formatCurrency(periodSummary?.totalExpense ?? 0, 'USD') }}</p>
          </div>
          <div class="summary-item">
            <p class="summary-label">Ahorro neto</p>
            <p class="summary-value" :class="{ expense: (periodSummary?.netSavings ?? 0) < 0 }">
              {{ formatCurrency(periodSummary?.netSavings ?? 0, 'USD') }}
            </p>
          </div>
        </div>

        <p v-if="periodSummary" class="summary-delta" :class="{ expense: netDelta < 0 }">{{ netDeltaLabel }}</p>
        <Transition name="loading-fade">
          <LoadingIndicator v-if="isLoadingSummary" label="Cargando resumen..." />
        </Transition>
      </BaseCard>

      <section class="analytics-section">
        <div class="section-header">
          <h2 class="section-title">Por categoría</h2>
          <div class="type-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              class="type-toggle-option"
              :aria-selected="categoryType === 'expense'"
              :class="{ active: categoryType === 'expense' }"
              @click="onCategoryTypeChange('expense')"
            >
              Gastos
            </button>
            <button
              type="button"
              role="tab"
              class="type-toggle-option"
              :aria-selected="categoryType === 'income'"
              :class="{ active: categoryType === 'income' }"
              @click="onCategoryTypeChange('income')"
            >
              Ingresos
            </button>
          </div>
        </div>

        <BaseCard>
          <Transition name="loading-fade" mode="out-in">
            <LoadingIndicator v-if="isLoadingCategories" key="loading" label="Cargando categorías..." />
            <CategoryPieChart v-else key="chart" :data="categoryBreakdown" />
          </Transition>
        </BaseCard>
      </section>

      <section class="analytics-section">
        <h2 class="section-title">Últimos 6 meses</h2>

        <BaseCard>
          <Transition name="loading-fade" mode="out-in">
            <LoadingIndicator v-if="isLoadingMonthly" key="loading" label="Cargando comparación..." />
            <MonthlyComparisonTable v-else key="table" :months="monthlyComparison" />
          </Transition>
        </BaseCard>
      </section>

      <p v-if="error" class="analytics-error" role="alert">{{ error }}</p>
    </div>
  </PageShell>
</template>

<style scoped>
.analytics-screen {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
}

.analytics-title {
  font-size: 1.375rem;
}

.summary-card {
  margin-top: 1.25rem;
}

.summary-period {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: capitalize;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.summary-value {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-h);
}

.summary-value.expense {
  color: var(--accent);
}

.summary-delta {
  margin-top: 0.875rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.8125rem;
  color: var(--text-h);
}

.summary-delta.expense {
  color: var(--accent);
}

.analytics-section {
  margin-top: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.section-title {
  font-size: 1.0625rem;
}

.type-toggle {
  display: inline-flex;
  gap: 0.375rem;
  padding: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: 1px solid var(--glass-border);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .type-toggle {
    background: var(--bg-inset);
  }
}

.type-toggle-option {
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.type-toggle-option:active {
  transform: scale(0.94);
}

.type-toggle-option.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

.analytics-error {
  margin-top: 1.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

@media (max-width: 380px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

/* Grid 2 columnas en escritorio: resumen arriba ocupando el ancho completo,
   "Por categoria" y "Ultimos 6 meses" lado a lado debajo. ".error" queda
   como una fila extra que colapsa a 0 cuando no hay ningun elemento con esa
   grid-area (no siempre hay error). ":deep(.donut)" hace falta aca porque
   .donut NO es la raiz de CategoryPieChart.vue (es un <svg> anidado dentro
   de su propio div.category-pie-chart) - el mecanismo normal de "el padre
   alcanza la raiz del hijo" no llega mas alla de esa raiz, asi que sin
   :deep() esta regla no aplicaria. */
@media (min-width: 1024px) {
  .analytics-screen {
    max-width: 68rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      'title    title'
      'summary  summary'
      'category monthly'
      'error    error';
    column-gap: 1.5rem;
    row-gap: 1.5rem;
    /* Sin esto, "category" (grafico de torta, mas bajo) se estira hasta
       igualar el alto de "monthly" (tabla, puede ser mas alta) o viceversa -
       mismo bug de stretch ya encontrado y arreglado en DashboardMain.vue. */
    align-items: start;
  }

  .analytics-title {
    grid-area: title;
    font-size: 1.75rem;
  }

  .summary-card {
    grid-area: summary;
    margin-top: 0;
  }

  .analytics-section:nth-of-type(1) {
    grid-area: category;
    margin-top: 0;
  }

  .analytics-section:nth-of-type(2) {
    grid-area: monthly;
    margin-top: 0;
  }

  .section-title {
    font-size: 1.25rem;
  }

  .analytics-error {
    grid-area: error;
    margin-top: 0;
  }

  :deep(.donut) {
    width: 9rem;
    height: 9rem;
  }
}

/* Animacion de entrada al cargar Analisis en escritorio - bloque separado
   del de layout, con el guard extra de prefers-reduced-motion. Fill-mode
   "backwards" (nunca "both"/"forwards"): .summary-card es tambien objetivo
   del hover de BaseCard.vue - "forwards" congelaria su transform para
   siempre y el hover-lift dejaria de funcionar en silencio. */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .analytics-title {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .summary-card {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 50ms;
  }

  .analytics-section:nth-of-type(1) {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 100ms;
  }

  .analytics-section:nth-of-type(2) {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 150ms;
  }
}
</style>
