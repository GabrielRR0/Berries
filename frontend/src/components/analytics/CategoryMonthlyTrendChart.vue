<script setup lang="ts">
import { computed } from 'vue'
import type { AnalyticsCategoryType, CategoryMonthlyTrend } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'

// "Cuanto se gasta mes a mes en X categoria" (pedido explicito del usuario,
// ej. "mercado", "gasolina") - a diferencia de CategoryPieChart.vue (una
// torta de UN solo mes), esto muestra, categoria por categoria, como
// evoluciona a lo largo de la ventana visible: el monto del mes mas
// reciente + una mini-sparkline con el resto del historial. Sin libreria de
// charts (ver limites del trabajo) - barras finas de CSS, mismo espiritu
// hecho a mano que MonthlyComparisonTable.vue.
const props = withDefaults(
  defineProps<{ trend: CategoryMonthlyTrend | null; type: AnalyticsCategoryType; currency?: string }>(),
  { currency: 'USD' },
)

interface CategoryRow {
  category: string
  latest: number
  bars: { month: string; heightPercent: number; isLatest: boolean }[]
  deltaLabel: string | null
  // Solo para gastos, y solo cuando el gasto SUBIO respecto al mes anterior -
  // mismo criterio que el resto de la app (ver AnalyticsMain.vue/
  // MonthlyComparisonTable.vue): el acento rojo se reserva para señalar algo
  // que empeoro, nunca para "celebrar" que algo subio (un ingreso que sube es
  // bueno, pero la app no tiene un color de "positivo" - se queda neutro).
  deltaFlagged: boolean
}

const rows = computed<CategoryRow[]>(() => {
  if (!props.trend) return []
  const { months, categories } = props.trend

  return categories.map((entry) => {
    const totals = entry.monthlyTotals
    // Escala PROPIA de cada categoria (no una escala global compartida): el
    // objetivo es ver la tendencia de esa categoria puntual, no compararla
    // en magnitud contra otras - una categoria chica (ej. "Streaming") con
    // una escala global quedaria invisible al lado de "Renta".
    const localMax = Math.max(1, ...totals)
    const latest = totals.at(-1) ?? 0
    const previous = totals.length >= 2 ? totals.at(-2)! : null

    let deltaLabel: string | null = null
    let deltaFlagged = false
    if (previous !== null) {
      const delta = latest - previous
      deltaFlagged = props.type === 'expense' && delta > 0
      deltaLabel = `${delta >= 0 ? '+' : ''}${formatCurrency(delta, props.currency)} vs mes anterior`
    }

    return {
      category: entry.category,
      latest,
      bars: totals.map((total, index) => ({
        month: months[index] ?? '',
        heightPercent: Math.max(4, (total / localMax) * 100),
        isLatest: index === totals.length - 1,
      })),
      deltaLabel,
      deltaFlagged,
    }
  })
})

function monthLabel(month: string): string {
  if (!month) return ''
  const [year, monthNumber] = month.split('-')
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  return new Intl.DateTimeFormat('es-VE', { month: 'short', year: 'numeric' }).format(date)
}
</script>

<template>
  <div class="category-trend">
    <div v-for="row in rows" :key="row.category" class="category-trend-row">
      <div class="category-trend-info">
        <span class="category-trend-name">{{ row.category }}</span>
        <span class="category-trend-latest">{{ formatCurrency(row.latest, currency) }}</span>
        <span v-if="row.deltaLabel" class="category-trend-delta" :class="{ flagged: row.deltaFlagged }">
          {{ row.deltaLabel }}
        </span>
      </div>

      <div class="category-trend-sparkline" role="img" :aria-label="`Evolución mensual de ${row.category}`">
        <span
          v-for="bar in row.bars"
          :key="bar.month"
          class="category-trend-bar"
          :class="{ current: bar.isLatest }"
          :style="{ height: `${bar.heightPercent}%` }"
          :title="monthLabel(bar.month)"
        />
      </div>
    </div>

    <p v-if="!rows.length" class="category-trend-empty">Sin datos para este período.</p>
  </div>
</template>

<style scoped>
.category-trend {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.category-trend-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 1rem;
}

.category-trend-row + .category-trend-row {
  padding-top: 1.125rem;
  border-top: 1px solid var(--border-subtle);
}

.category-trend-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.category-trend-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-trend-latest {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-h);
}

.category-trend-delta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.category-trend-delta.flagged {
  color: var(--accent);
}

.category-trend-sparkline {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 0.1875rem;
  width: 5.5rem;
  height: 2.5rem;
}

.category-trend-bar {
  flex: 1;
  min-width: 0.125rem;
  border-radius: 1px;
  background: var(--border);
  transition: height var(--duration-base) var(--ease-out);
}

.category-trend-bar.current {
  background: var(--text-h);
}

.category-trend-empty {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

@media (max-width: 340px) {
  .category-trend-sparkline {
    width: 4rem;
  }
}
</style>
