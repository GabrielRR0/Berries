<script setup lang="ts">
import { computed, ref } from 'vue'
import { amountAsPercentOfTotal, percentOfAmount } from '../../utils/calculator/percentageCalculator'

// Dos cuentas independientes, cada una con sus propios inputs - ver
// percentageCalculator.ts. No comparten estado entre si a proposito: son dos
// preguntas distintas ("cuanto es X% de esto" vs "esto es que % de aquello"),
// mezclarlas en un solo formulario confundiria mas de lo que ayuda.
const tipAmount = ref('')
const tipPercent = ref('')
const tipResult = computed(() => {
  if (!tipAmount.value || !tipPercent.value) return null
  return percentOfAmount(Number(tipAmount.value), Number(tipPercent.value))
})

const shareAmount = ref('')
const shareTotal = ref('')
const shareResult = computed(() => {
  if (!shareAmount.value || !shareTotal.value) return null
  return amountAsPercentOfTotal(Number(shareAmount.value), Number(shareTotal.value))
})
</script>

<template>
  <div class="percentage-calculator">
    <section class="percentage-block">
      <h2 class="block-title">¿Cuánto es el X% de un monto?</h2>
      <p class="block-hint">Por ejemplo, una propina del 10% sobre $45.</p>

      <div class="field-row">
        <label class="field">
          <span class="field-label">Monto</span>
          <input v-model="tipAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
        </label>
        <label class="field">
          <span class="field-label">Porcentaje</span>
          <input v-model="tipPercent" type="number" min="0" step="0.01" inputmode="decimal" placeholder="10" />
        </label>
      </div>

      <div v-if="tipResult !== null" class="result-card">
        <span class="result-label">Resultado</span>
        <span class="result-value">{{ tipResult.toFixed(2) }}</span>
      </div>
    </section>

    <section class="percentage-block">
      <h2 class="block-title">¿Qué % representa un monto de un total?</h2>
      <p class="block-hint">Por ejemplo, gastaste $120 de un presupuesto de $500.</p>

      <div class="field-row">
        <label class="field">
          <span class="field-label">Monto</span>
          <input v-model="shareAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
        </label>
        <label class="field">
          <span class="field-label">Total</span>
          <input v-model="shareTotal" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
        </label>
      </div>

      <div v-if="shareResult !== null" class="result-card">
        <span class="result-label">Resultado</span>
        <span class="result-value">{{ shareResult.toFixed(2) }}%</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.percentage-calculator {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.percentage-block {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.block-title {
  font-size: 1rem;
}

.block-hint {
  margin-top: -0.5rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
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
  /* min-width:0 pisa el "auto" por defecto de los items de grid: sin esto,
     un input (con su ancho intrinseco de ~20ch) fuerza a la columna 1fr a
     ese minimo y desborda el margen del telefono en pantallas chicas (bug
     real reportado por el usuario). */
  min-width: 0;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.field input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
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

/* Pisa el aro de foco global (ver style.css: input:focus-visible{box-shadow:
   var(--focus-ring)}) - el cambio de color de borde de arriba ya alcanza
   como señal de foco; el box-shadow encima se veia como un recuadro feo al
   tocar el input (bug real reportado por el usuario). */
.field input:focus-visible {
  box-shadow: none;
}

.result-card {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
}

.result-label {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.result-value {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-h);
}
</style>
