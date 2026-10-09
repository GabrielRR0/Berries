<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getRateHistory } from '../../services/currency/currency.service'
import type { RateHistoryPoint } from '../../services/currency/interfaces/currency.interface'
import { SUPPORTED_CURRENCIES } from '../../utils/currency/supportedCurrencies'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import PillCurrencyToggle from '../ui/PillCurrencyToggle.vue'
import RateHistoryChart from './RateHistoryChart.vue'

// Pantalla "Tasas" (/tasas) - pedido explicito del usuario: "tener bien
// registrado el precio de la moneda nacional a su tasa... y tener un
// gráfico de cómo sube o baja su valor". Los datos ya existian (ExchangeRate
// es un log append-only, nunca se pisa una fila al refrescar - ver
// cache_refresh.py) pero nunca se habian expuesto en la UI, solo se usaban
// internamente para convertir montos. Monedas nacionales unicamente (VEF/COP/
// ARS) - USD/EUR/USDT no tienen el problema de inflacion que motiva esta
// pantalla, y ya se pueden comparar entre si en la Calculadora.
const NATIONAL_CURRENCIES = SUPPORTED_CURRENCIES.filter((currency) => ['VEF', 'COP', 'ARS'].includes(currency.code))
const MONTHS_WINDOW_OPTIONS = [3, 6, 12]

type Series = 'oficial' | 'transferencias'

const router = useRouter()
const showHelpSheet = ref(false)
const selectedCurrency = ref(NATIONAL_CURRENCIES[0]!.code)
const monthsWindow = ref(6)
const activeSeries = ref<Series>('oficial')
const officialPoints = ref<RateHistoryPoint[]>([])
// Serie de tasas IMPLÍCITAS reales del usuario (ver
// transfer_service._record_transfer_rate_observation del backend) - la tasa que él
// de verdad consiguió al cambiar USDT por su moneda nacional, no la oficial/BCV.
// Pedido explícito del usuario: "quiero comparativas... de cuánto estaba aprox el
// usdt ese día y a esa hora". Solo se muestra la pestaña si hay al menos un dato.
const transferPoints = ref<RateHistoryPoint[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)

const hasTransferSeries = computed(() => transferPoints.value.length > 0)
const points = computed(() => (activeSeries.value === 'transferencias' ? transferPoints.value : officialPoints.value))
const currentRate = computed(() => points.value.at(-1) ?? null)

async function loadHistory() {
  isLoading.value = true
  loadError.value = null
  try {
    const [official, transfers] = await Promise.all([
      getRateHistory(selectedCurrency.value, monthsWindow.value, 'USD'),
      // Best-effort: si esta llamada falla, la comparativa simplemente no se
      // ofrece (no es el contenido principal de la pantalla) - no debe tumbar
      // la serie oficial, que sí lo es.
      getRateHistory(selectedCurrency.value, monthsWindow.value, 'USDT').catch(() => ({ points: [] })),
    ])
    officialPoints.value = official.points
    transferPoints.value = transfers.points
    if (activeSeries.value === 'transferencias' && transferPoints.value.length === 0) {
      activeSeries.value = 'oficial'
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudo cargar el historial de tasas.'
  } finally {
    isLoading.value = false
  }
}

watch([selectedCurrency, monthsWindow], loadHistory)
onMounted(loadHistory)

function goBack() {
  router.push({ name: 'ajustes' })
}
</script>

<template>
  <PageShell>
    <SectionHeader title="Tasas" @back="goBack" @help="showHelpSheet = true" />

    <div class="rates-screen">
      <PillCurrencyToggle
        v-model="selectedCurrency"
        :currencies="NATIONAL_CURRENCIES.map((currency) => currency.code)"
        class="currency-toggle"
      />

      <BaseCard class="rate-card">
        <div v-if="hasTransferSeries" class="series-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            class="series-toggle-option"
            :aria-selected="activeSeries === 'oficial'"
            :class="{ active: activeSeries === 'oficial' }"
            @click="activeSeries = 'oficial'"
          >
            Oficial (BCV)
          </button>
          <button
            type="button"
            role="tab"
            class="series-toggle-option"
            :aria-selected="activeSeries === 'transferencias'"
            :class="{ active: activeSeries === 'transferencias' }"
            @click="activeSeries = 'transferencias'"
          >
            Tus transferencias
          </button>
        </div>

        <div class="rate-card-header">
          <div>
            <span class="rate-card-label">
              {{ selectedCurrency }} por {{ activeSeries === 'transferencias' ? 'USDT' : 'USD' }}, ahora
            </span>
            <p class="rate-card-value">
              <template v-if="currentRate">{{ currentRate.rate.toFixed(4) }}</template>
              <template v-else>—</template>
            </p>
            <span v-if="currentRate?.isEstimated" class="rate-card-estimated">Tasa estimada (respaldo)</span>
          </div>

          <div class="months-toggle" role="tablist">
            <button
              v-for="option in MONTHS_WINDOW_OPTIONS"
              :key="option"
              type="button"
              role="tab"
              class="months-toggle-option"
              :aria-selected="monthsWindow === option"
              :class="{ active: monthsWindow === option }"
              @click="monthsWindow = option"
            >
              {{ option }}M
            </button>
          </div>
        </div>

        <Transition name="loading-fade" mode="out-in">
          <LoadingIndicator v-if="isLoading" key="loading" label="Cargando historial..." />
          <p v-else-if="loadError" key="error" class="rate-error" role="alert">{{ loadError }}</p>
          <RateHistoryChart
            v-else
            :key="activeSeries"
            :points="points"
            :currency-code="selectedCurrency"
            :quote-code="activeSeries === 'transferencias' ? 'USDT' : 'USD'"
          />
        </Transition>
      </BaseCard>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Tasas?" @close="showHelpSheet = false">
      <p class="help-text">
        Aquí puedes ver cómo se movió el valor de tu moneda nacional frente al dólar a lo largo del tiempo. Cada
        movimiento que registres en esa moneda queda convertido a dólares usando la tasa vigente ese día, no la de
        hoy - así tu historial no cambia cada vez que la tasa se mueve. Si un día no hubo una lectura real disponible,
        la tasa usada queda marcada como "estimada". Si alguna vez transferiste USDT a esta moneda, también vas a ver
        la pestaña "Tus transferencias": la tasa real que conseguiste vos, calculada a partir de esos movimientos -
        útil para comparar contra la oficial.
      </p>
    </BottomSheet>
  </PageShell>
</template>

<style scoped>
.rates-screen {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 30rem;
  margin: 0 auto;
}

.currency-toggle {
  align-self: center;
}

.rate-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.series-toggle {
  display: inline-flex;
  align-self: flex-start;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}

.series-toggle-option {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.series-toggle-option.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

.rate-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.rate-card-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.rate-card-value {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-h);
}

.rate-card-estimated {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
}

.months-toggle {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}

.months-toggle-option {
  padding: 0.25rem 0.625rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.months-toggle-option.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

.rate-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.help-text {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-muted);
}
</style>
