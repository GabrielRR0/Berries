<script setup lang="ts">
// Boxes de Ingresos/Gastos del MES ACTIVO en Movimientos (ver MonthPager.vue
// en TransactionsMain.vue) - version puramente informativa, sin click ni
// bottom sheet propio. A diferencia de IncomeExpenseSummary.vue (Inicio),
// aca abajo ya esta el listado completo filtrado (Historial): abrir otro
// sheet solo para ver el mismo detalle de nuevo seria redundante. Deliberado
// no retocar/reusar IncomeExpenseSummary.vue aca - esta version es mas chica
// y evita arriesgar regresiones en la de Inicio.
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import BaseCard from '../ui/BaseCard.vue'
import IconBadge from '../ui/IconBadge.vue'

defineProps<{ income: number; expenses: number; currency: string }>()
</script>

<template>
  <div class="month-summary-cards">
    <BaseCard :padded="false" class="summary-card">
      <div class="summary-heading">
        <IconBadge variant="income" size="sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </IconBadge>
        <p class="summary-label">Ingresos</p>
      </div>
      <p class="summary-amount">
        <AnimatedCurrency :value="income" :currency="currency" direction="up" />
      </p>
    </BaseCard>

    <BaseCard :padded="false" class="summary-card">
      <div class="summary-heading">
        <IconBadge variant="expense" size="sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M6 13l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </IconBadge>
        <p class="summary-label">Gastos</p>
      </div>
      <p class="summary-amount expense">
        <AnimatedCurrency :value="expenses" :currency="currency" direction="down" />
      </p>
    </BaseCard>
  </div>
</template>

<style scoped>
.month-summary-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.summary-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1rem;
}

.summary-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.summary-amount {
  font-size: 1.1875rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-h);
}

.summary-amount.expense {
  color: var(--accent);
}

@media (max-width: 380px) {
  .summary-amount {
    font-size: 1.15rem;
  }
}
</style>
