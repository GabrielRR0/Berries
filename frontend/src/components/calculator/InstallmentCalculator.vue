<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCurrencyStore } from '../../stores/currency.store'
import { calculateInstallmentPlan } from '../../utils/calculator/installmentCalculator'
import { formatCurrency } from '../../utils/formatters/formatCurrency'

// Simulacion pura client-side (no pega a ningun endpoint) para planear una
// deuda ANTES de cargarla de verdad en Deudas - ver installmentCalculator.ts
// para la formula. La moneda es solo para formatear el resultado (no hace
// falta convertir nada aca), se toma la de currency.store.ts como default
// razonable, el usuario la puede cambiar sin que afecte ningun otro lado de
// la app.
const currencyStore = useCurrencyStore()

const amount = ref('')
const installmentCount = ref('12')
const annualInterestRate = ref('')
const currency = ref(currencyStore.displayCurrency)

const plan = computed(() => {
  const principal = Number(amount.value)
  const count = Number(installmentCount.value)
  const rate = annualInterestRate.value ? Number(annualInterestRate.value) : 0
  if (!amount.value || !installmentCount.value) return null
  return calculateInstallmentPlan(principal, count, rate)
})
</script>

<template>
  <div class="installment-calculator">
    <div class="field-row">
      <label class="field">
        <span class="field-label">Monto total</span>
        <input v-model="amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
      </label>

      <label class="field">
        <span class="field-label">Moneda</span>
        <input v-model="currency" type="text" maxlength="4" placeholder="USD" />
      </label>
    </div>

    <div class="field-row">
      <label class="field">
        <span class="field-label">N.° de cuotas</span>
        <input v-model="installmentCount" type="number" min="1" step="1" inputmode="numeric" placeholder="12" />
      </label>

      <label class="field">
        <span class="field-label">Interés anual % (opcional)</span>
        <input v-model="annualInterestRate" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" />
      </label>
    </div>

    <p class="field-hint">
      Dejá el interés vacío para un préstamo sin recargo (ej. entre familia/amigos) - se divide el monto en partes
      iguales.
    </p>

    <div v-if="plan" class="result-card">
      <div class="result-row">
        <span class="result-label">Cuota</span>
        <span class="result-value">{{ formatCurrency(plan.installmentAmount, currency) }}</span>
      </div>
      <div class="result-row secondary">
        <span class="result-label">Total a pagar</span>
        <span class="result-value-sm">{{ formatCurrency(plan.totalPaid, currency) }}</span>
      </div>
      <div v-if="plan.totalInterest > 0" class="result-row secondary">
        <span class="result-label">Interés total</span>
        <span class="result-value-sm expense">{{ formatCurrency(plan.totalInterest, currency) }}</span>
      </div>
    </div>

    <p v-else-if="amount && installmentCount" class="installment-error" role="alert">
      Revisá el monto y la cantidad de cuotas - tienen que ser mayores a cero.
    </p>
  </div>
</template>

<style scoped>
.installment-calculator {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.field input {
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field input:focus {
  outline: none;
  border-color: var(--accent);
}

.field-hint {
  margin-top: -0.25rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.result-card {
  margin-top: 0.5rem;
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
}

.result-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.result-row + .result-row {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
}

.result-label {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.result-value {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-h);
}

.result-value-sm {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-h);
}

.result-value-sm.expense {
  color: var(--accent);
}

.installment-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}
</style>
