<script setup lang="ts">
import { computed } from 'vue'
import type { MonthlyComparison } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'

// Comparacion de los ultimos N meses (ver GET /api/analytics/monthly) como un
// mini grafico de barras agrupadas (2 barras por mes: ingreso/gasto) - pedido
// explicito del usuario de modernizar Analisis. La version anterior (una fila
// larga por mes, cada una con 2 barras horizontales + su propio numero)
// ocupaba mucho alto vertical y no escalaba bien a 12 meses; esta cabe en una
// sola tira compacta a cualquiera de las 3 ventanas (3/6/12, ver
// AnalyticsMain.vue). El valor neto en numero solo se muestra para el mes
// ACTUAL (la columna con mas para contar) - con 12 columnas angostas no
// entra un monto completo en cada una, y el resto ya se lee por el alto
// relativo de sus barras + el title de hover con el detalle exacto. Ingresos
// usa gris neutro, gastos usa el rojo de marca - mismo criterio de color que
// el resto de la app (nunca verde para "positivo").
const props = withDefaults(defineProps<{ months: MonthlyComparison[]; currency?: string }>(), { currency: 'USD' })

// Una unica escala compartida entre TODAS las barras (ingresos y gastos de
// todos los meses) para que el alto de una barra sea comparable con el de
// cualquier otra - nunca una escala por mes.
const maxValue = computed(() => {
  const values = props.months.flatMap((entry) => [entry.totalIncome, entry.totalExpense])
  return Math.max(1, ...values)
})

// Piso del 4% (no 0%) - mismo criterio que CategoryMonthlyTrendChart.vue: un
// mes en $0 sigue mostrando una barra visible en vez de una linea invisible
// que se confunde con "no hay dato" (pedido explicito del usuario: la
// version anterior con piso de 2% se veia "muy basica" en una cuenta con
// poco historial - casi todas las barras desaparecian).
function barHeightPercent(value: number): number {
  return Math.max(4, Math.min(100, (value / maxValue.value) * 100))
}

function monthLabel(month: string, style: 'short' | 'long' = 'short'): string {
  const [year, monthNumber] = month.split('-')
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  return new Intl.DateTimeFormat('es-VE', { month: style, year: style === 'long' ? 'numeric' : undefined }).format(date)
}
</script>

<template>
  <div class="monthly-comparison">
    <template v-if="months.length">
      <div class="monthly-legend">
        <span class="monthly-legend-item"><span class="monthly-legend-swatch income" />Ingresos</span>
        <span class="monthly-legend-item"><span class="monthly-legend-swatch expense" />Gastos</span>
      </div>

      <div class="monthly-bars" :style="{ '--column-count': months.length }">
        <div
          v-for="(entry, index) in months"
          :key="entry.month"
          class="monthly-bar-column"
          :class="{ current: index === months.length - 1 }"
        >
          <span v-if="index === months.length - 1" class="monthly-bar-net" :class="{ negative: entry.net < 0 }">
            {{ formatCurrency(entry.net, currency) }}
          </span>

          <div class="monthly-bar-pair">
            <span
              class="monthly-bar income"
              :style="{ height: `${barHeightPercent(entry.totalIncome)}%` }"
              :title="`Ingresos ${monthLabel(entry.month, 'long')}: ${formatCurrency(entry.totalIncome, currency)}`"
            />
            <span
              class="monthly-bar expense"
              :style="{ height: `${barHeightPercent(entry.totalExpense)}%` }"
              :title="`Gastos ${monthLabel(entry.month, 'long')}: ${formatCurrency(entry.totalExpense, currency)}`"
            />
          </div>

          <span class="monthly-bar-label">{{ monthLabel(entry.month) }}</span>
        </div>
      </div>
    </template>

    <p v-else class="monthly-empty">No hay datos para mostrar todavía.</p>
  </div>
</template>

<style scoped>
.monthly-comparison {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.monthly-legend {
  display: flex;
  align-items: center;
  gap: 1rem;
  align-self: flex-end;
}

.monthly-legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.monthly-legend-swatch {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-pill);
}

.monthly-legend-swatch.income {
  background: var(--text-h);
}

.monthly-legend-swatch.expense {
  background: var(--accent);
}

/* Lineas de fondo (25/50/75% de alto) via 3 capas de background-image (no
   elementos aparte) - un fondo SIEMPRE pinta detras del contenido del mismo
   elemento, sin ninguna duda de stacking-context/z-index que si aparecia
   con un enfoque de elementos position:absolute. Sin esto, un mes con poco
   historial (la mayoria de las barras al piso minimo) se veia como una caja
   vacia con un par de rayitas sueltas - pedido explicito del usuario de que
   no se sienta "muy basico". */
.monthly-bars {
  display: grid;
  grid-template-columns: repeat(var(--column-count), 1fr);
  gap: 0.5rem;
  align-items: end;
  height: 8.75rem;
  background-image:
    linear-gradient(var(--border-subtle), var(--border-subtle)),
    linear-gradient(var(--border-subtle), var(--border-subtle)),
    linear-gradient(var(--border-subtle), var(--border-subtle));
  background-size: 100% 1px;
  background-position:
    0 25%,
    0 50%,
    0 75%;
  background-repeat: no-repeat;
}

.monthly-bar-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  height: 100%;
  min-width: 0;
}

.monthly-bar-net {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-h);
  white-space: nowrap;
}

.monthly-bar-net.negative {
  color: var(--accent);
}

.monthly-bar-pair {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
}

.monthly-bar {
  width: 0.75rem;
  border-radius: 4px 4px 0 0;
  transition: height var(--duration-base) var(--ease-out);
}

.monthly-bar.income {
  background: linear-gradient(180deg, var(--text-h), rgba(246, 246, 247, 0.55));
}

.monthly-bar.expense {
  background: linear-gradient(180deg, var(--accent), var(--accent-strong));
}

.monthly-bar-label {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-transform: capitalize;
}

.monthly-bar-column.current .monthly-bar-label {
  font-weight: 700;
  color: var(--text-h);
}

.monthly-empty {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

@media (max-width: 420px) {
  .monthly-bar {
    width: 0.5625rem;
  }

  .monthly-bar-net {
    font-size: 0.6875rem;
  }
}
</style>
