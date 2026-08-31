<script setup lang="ts">
import { computed } from 'vue'
import type { MonthlyComparison } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'

// Comparacion de los ultimos N meses (ver GET /api/analytics/monthly) como
// barras horizontales de CSS - sin libreria de charts (ver limites del
// trabajo). Ingresos usa gris neutro, gastos usa el rojo de marca: mismo
// criterio de color que el resto de la app (ver IncomeExpenseSummary.vue),
// nunca verde para "positivo".
const props = withDefaults(defineProps<{ months: MonthlyComparison[]; currency?: string }>(), { currency: 'USD' })

// Una unica escala compartida entre todas las barras (ingresos y gastos de
// todos los meses) para que el largo de una barra sea comparable con el de
// cualquier otra - nunca una escala por fila.
const maxValue = computed(() => {
  const values = props.months.flatMap((entry) => [entry.totalIncome, entry.totalExpense])
  return Math.max(1, ...values)
})

function barWidth(value: number): string {
  return `${Math.min(100, (value / maxValue.value) * 100)}%`
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-')
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  return new Intl.DateTimeFormat('es-VE', { month: 'short', year: 'numeric' }).format(date)
}
</script>

<template>
  <div class="monthly-comparison">
    <div v-for="entry in months" :key="entry.month" class="month-row">
      <div class="month-row-header">
        <span class="month-label">{{ monthLabel(entry.month) }}</span>
        <span class="month-net" :class="{ negative: entry.net < 0 }">
          {{ formatCurrency(entry.net, currency) }}
        </span>
      </div>

      <div class="bar-line">
        <span class="bar-line-label">Ingresos</span>
        <div class="bar-track">
          <div class="bar-fill income" :style="{ width: barWidth(entry.totalIncome) }" />
        </div>
        <span class="bar-line-value">{{ formatCurrency(entry.totalIncome, currency) }}</span>
      </div>

      <div class="bar-line">
        <span class="bar-line-label">Gastos</span>
        <div class="bar-track">
          <div class="bar-fill expense" :style="{ width: barWidth(entry.totalExpense) }" />
        </div>
        <span class="bar-line-value">{{ formatCurrency(entry.totalExpense, currency) }}</span>
      </div>
    </div>

    <p v-if="!months.length" class="monthly-empty">No hay datos para mostrar todavía.</p>
  </div>
</template>

<style scoped>
.monthly-comparison {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.month-row + .month-row {
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-subtle);
}

.month-row-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.625rem;
}

.month-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-h);
  text-transform: capitalize;
}

.month-net {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-h);
}

.month-net.negative {
  color: var(--accent);
}

.bar-line {
  display: grid;
  grid-template-columns: 3.75rem 1fr auto;
  align-items: center;
  gap: 0.625rem;
}

.bar-line + .bar-line {
  margin-top: 0.375rem;
}

.bar-line-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.bar-track {
  height: 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--bg-inset);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: inherit;
  transition: width var(--duration-base) var(--ease-out);
}

.bar-fill.income {
  background: var(--text-muted);
}

.bar-fill.expense {
  background: var(--accent);
}

.bar-line-value {
  min-width: 4.5rem;
  text-align: right;
  font-size: 0.75rem;
  color: var(--text);
}

.monthly-empty {
  font-size: 0.8125rem;
  color: var(--text-muted);
}
</style>
