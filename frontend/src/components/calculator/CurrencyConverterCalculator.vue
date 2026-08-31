<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCurrency } from '../../composables/currency/useCurrency'
import { SUPPORTED_CURRENCIES } from '../../utils/currency/supportedCurrencies'
import { formatCurrency } from '../../utils/formatters/formatCurrency'

// Reusa useCurrency() (mismo composable que BalanceCard.vue) - pega al
// endpoint real de conversion del backend, no es una tasa hardcodeada a mano.
// La conversion en si es generica (ver currency_service.py - pivotea por USD
// para cualquier par de codigos con tasa conocida), asi que esta lista es
// solo la de monedas que la app ofrece en selects (ver supportedCurrencies.ts).
const CURRENCIES = SUPPORTED_CURRENCIES.map((currency) => currency.code)

const { isConverting, conversionError, convert } = useCurrency()

const amount = ref('1')
const fromCurrency = ref('USD')
const toCurrency = ref('EUR')
const result = ref<number | null>(null)
const rateUsed = ref<number | null>(null)

async function runConversion() {
  const value = Number(amount.value)
  if (!Number.isFinite(value) || value < 0) {
    result.value = null
    return
  }
  try {
    const conversion = await convert(value, fromCurrency.value, toCurrency.value)
    result.value = conversion.convertedAmount
    rateUsed.value = conversion.rateUsed
  } catch {
    // El error ya queda expuesto via conversionError (reactivo de
    // useCurrency) - se muestra en el template, no hace falta duplicarlo.
    result.value = null
  }
}

function swapCurrencies() {
  const previousFrom = fromCurrency.value
  fromCurrency.value = toCurrency.value
  toCurrency.value = previousFrom
}

// Recalcula automaticamente ante cualquier cambio - sin boton "Convertir"
// aparte, se siente mas inmediato para una calculadora.
watch([amount, fromCurrency, toCurrency], runConversion, { immediate: true })
</script>

<template>
  <div class="currency-converter">
    <label class="field">
      <span class="field-label">Monto</span>
      <input v-model="amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
    </label>

    <div class="currency-row">
      <label class="field">
        <span class="field-label">De</span>
        <select v-model="fromCurrency">
          <option v-for="currency in CURRENCIES" :key="currency" :value="currency">{{ currency }}</option>
        </select>
      </label>

      <button type="button" class="swap-button" aria-label="Invertir monedas" @click="swapCurrencies">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7h13l-3-3M17 7l-3 3" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M20 17H7l3-3M7 17l3 3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <label class="field">
        <span class="field-label">A</span>
        <select v-model="toCurrency">
          <option v-for="currency in CURRENCIES" :key="currency" :value="currency">{{ currency }}</option>
        </select>
      </label>
    </div>

    <p v-if="conversionError" class="converter-error" role="alert">{{ conversionError }}</p>

    <div v-else class="result-card">
      <p class="result-label">Resultado</p>
      <p class="result-value">
        <span v-if="isConverting">Calculando...</span>
        <span v-else-if="result !== null">{{ formatCurrency(result, toCurrency) }}</span>
        <span v-else class="result-placeholder">—</span>
      </p>
      <p v-if="rateUsed !== null && result !== null" class="result-rate">
        1 {{ fromCurrency }} = {{ rateUsed.toFixed(4) }} {{ toCurrency }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.currency-converter {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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

.field input,
.field select {
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  /* 1rem, no menos: evita el zoom automatico de iOS Safari al enfocar. */
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--accent);
}

.currency-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  gap: 0.75rem;
}

.swap-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.swap-button svg {
  width: 1.125rem;
  height: 1.125rem;
}

.swap-button:hover {
  opacity: 0.85;
}

.swap-button:active {
  transform: scale(0.9) rotate(180deg);
}

.converter-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.result-card {
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  text-align: center;
}

.result-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.result-value {
  margin-top: 0.5rem;
  font-size: clamp(1.75rem, 8vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-h);
}

.result-placeholder {
  color: var(--text-muted);
}

.result-rate {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}
</style>
