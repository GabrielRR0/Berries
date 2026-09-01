<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAnalytics } from '../../composables/analytics/useAnalytics'
import type { AnalyticsCategoryType } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import IconBadge from '../ui/IconBadge.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import CategoryMonthlyTrendChart from './CategoryMonthlyTrendChart.vue'
import CategoryPieChart from './CategoryPieChart.vue'
import CumulativeSavingsChart from './CumulativeSavingsChart.vue'
import MonthlyComparisonTable from './MonthlyComparisonTable.vue'

// Pantalla "Análisis", ruteada en /analitica. Pedido explicito del usuario de
// modernizarla ("se ha quedado atrás" frente al resto de la app, y despues
// "no se siente vivo humano" sobre un primer mockup en /design) - rediseño
// aprobado en ese canvas antes de construirse aca (mismo criterio que
// BalanceCard.vue/BalanceTrendBackdrop.vue en Inicio, que paso por el mismo
// proceso: "nuestro propio grafico... que haga ver viva la app"). El punto
// brillante del mes actual en CumulativeSavingsChart.vue reusa exactamente
// ese lenguaje ya aprobado (glow + nucleo con drop-shadow).
//
// Suma dos vistas que faltaban -
//   - "Ahorro acumulado": suma el ahorro (ingreso - gasto) mes a mes dentro
//     de la ventana visible, no solo el neto de UN mes (CumulativeSavingsChart.vue) -
//     ahora la seccion hero de la pantalla, como el balance lo es en Inicio.
//   - "Tendencia por categoría": cuanto se gasta/ingresa en cada categoría,
//     mes a mes (ej. "cuánto gasté en Mercado cada mes",
//     CategoryMonthlyTrendChart.vue) - usa el endpoint nuevo
//     GET /api/analytics/categories/trend.
// Ambas comparten estado con secciones ya existentes: el toggle de meses
// (3/6/12, ahora dentro de la tarjeta hero) mueve tanto el acumulado como
// "Últimos N meses"; el toggle de Gastos/Ingresos mueve tanto la torta por
// categoría como su tendencia.
// El contrato de /api/analytics no manda moneda, asi que se usa 'USD' como
// default, igual que BalanceCard.vue/IncomeExpenseSummary.vue.
const router = useRouter()
const showHelpSheet = ref(false)

const {
  periodSummary,
  categoryBreakdown,
  monthlyComparison,
  categoryTrend,
  isLoadingSummary,
  isLoadingCategories,
  isLoadingMonthly,
  isLoadingCategoryTrend,
  error,
  fetchPeriodSummary,
  fetchCategoryBreakdown,
  fetchMonthlyComparison,
  fetchCategoryTrend,
} = useAnalytics()

const categoryType = ref<AnalyticsCategoryType>('expense')
const monthsWindow = ref(6)
const MONTHS_WINDOW_OPTIONS = [3, 6, 12]

const periodLabel = computed(() => {
  if (!periodSummary.value) return ''
  const [year, month] = periodSummary.value.period.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  const formatted = new Intl.DateTimeFormat('es-VE', { month: 'long', year: 'numeric' }).format(date)
  // Solo la primera letra, a mano (no text-transform:capitalize en el CSS):
  // "septiembre de 2026" tiene un conector "de" en el medio que capitalize
  // pondria en mayuscula tambien ("Septiembre De 2026"), un error real que
  // se vio en vivo.
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
})

const netDelta = computed(() => {
  if (!periodSummary.value) return 0
  return periodSummary.value.netSavings - periodSummary.value.previousPeriodNetSavings
})

const netDeltaLabel = computed(() => {
  if (!periodSummary.value) return ''
  const sign = netDelta.value > 0 ? '+' : ''
  return `${sign}${formatCurrency(netDelta.value, 'USD')} vs mes anterior`
})

const categoryTrendTitle = computed(() =>
  categoryType.value === 'expense' ? 'Gastos por categoría, mes a mes' : 'Ingresos por categoría, mes a mes',
)

function goBack() {
  router.push({ name: 'dashboard' })
}

async function onCategoryTypeChange(type: AnalyticsCategoryType) {
  categoryType.value = type
  await Promise.all([fetchCategoryBreakdown(type), fetchCategoryTrend(type, monthsWindow.value)])
}

async function onMonthsWindowChange(months: number) {
  monthsWindow.value = months
  await Promise.all([fetchMonthlyComparison(months), fetchCategoryTrend(categoryType.value, months)])
}

onMounted(() => {
  fetchPeriodSummary()
  fetchCategoryBreakdown(categoryType.value)
  fetchMonthlyComparison(monthsWindow.value)
  fetchCategoryTrend(categoryType.value, monthsWindow.value)
})
</script>

<template>
  <PageShell>
    <SectionHeader title="Análisis" max-width="68rem" @back="goBack" @help="showHelpSheet = true" />

    <div class="analytics-screen">
      <span v-if="periodLabel" class="analytics-period">
        <span class="analytics-period-dot" aria-hidden="true"><span class="analytics-period-dot-core" /></span>
        {{ periodLabel }}
      </span>

      <section class="analytics-section hero-section">
        <div class="hero-card">
          <span class="hero-keyline" aria-hidden="true" />

          <div class="hero-header">
            <span class="hero-label">Ahorro acumulado &middot; {{ monthsWindow }} meses</span>
            <div class="type-toggle" role="tablist">
              <button
                v-for="option in MONTHS_WINDOW_OPTIONS"
                :key="option"
                type="button"
                role="tab"
                class="type-toggle-option"
                :aria-selected="monthsWindow === option"
                :class="{ active: monthsWindow === option }"
                @click="onMonthsWindowChange(option)"
              >
                {{ option }}M
              </button>
            </div>
          </div>

          <Transition name="loading-fade" mode="out-in">
            <LoadingIndicator v-if="isLoadingMonthly" key="loading" label="Cargando ahorro acumulado..." />
            <CumulativeSavingsChart v-else key="chart" :months="monthlyComparison" currency="USD" />
          </Transition>
        </div>
      </section>

      <section class="analytics-section stat-section">
        <Transition name="loading-fade" mode="out-in">
          <LoadingIndicator v-if="isLoadingSummary" key="loading" label="Cargando resumen..." />

          <div v-else key="stats" class="stat-grid">
            <div class="stat-card">
              <div class="stat-heading">
                <IconBadge variant="income" size="sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </IconBadge>
                <span class="stat-label">Ingresos</span>
              </div>
              <p class="stat-value">
                <AnimatedCurrency :value="periodSummary?.totalIncome ?? 0" currency="USD" direction="up" />
              </p>
            </div>

            <div class="stat-card expense-tint">
              <div class="stat-heading">
                <IconBadge variant="expense" size="sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M6 13l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </IconBadge>
                <span class="stat-label">Gastos</span>
              </div>
              <p class="stat-value expense">
                <AnimatedCurrency :value="periodSummary?.totalExpense ?? 0" currency="USD" direction="down" />
              </p>
            </div>

            <div class="stat-card net">
              <span class="stat-label">Ahorro neto</span>
              <div class="stat-net-row">
                <p class="stat-value" :class="{ expense: (periodSummary?.netSavings ?? 0) < 0 }">
                  <AnimatedCurrency
                    :value="periodSummary?.netSavings ?? 0"
                    currency="USD"
                    :direction="(periodSummary?.netSavings ?? 0) < 0 ? 'down' : 'up'"
                  />
                </p>
                <span v-if="periodSummary" class="stat-delta" :class="{ expense: netDelta < 0 }">{{ netDeltaLabel }}</span>
              </div>
            </div>
          </div>
        </Transition>
      </section>

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

        <div class="glass-card">
          <Transition name="loading-fade" mode="out-in">
            <LoadingIndicator v-if="isLoadingCategories" key="loading" label="Cargando categorías..." />
            <CategoryPieChart v-else key="chart" :data="categoryBreakdown" />
          </Transition>
        </div>
      </section>

      <section class="analytics-section">
        <h2 class="section-title">{{ categoryTrendTitle }}</h2>

        <div class="glass-card">
          <Transition name="loading-fade" mode="out-in">
            <LoadingIndicator v-if="isLoadingCategoryTrend" key="loading" label="Cargando tendencia..." />
            <CategoryMonthlyTrendChart v-else key="chart" :trend="categoryTrend" :type="categoryType" currency="USD" />
          </Transition>
        </div>
      </section>

      <section class="analytics-section">
        <h2 class="section-title">Últimos {{ monthsWindow }} meses</h2>

        <div class="glass-card">
          <Transition name="loading-fade" mode="out-in">
            <LoadingIndicator v-if="isLoadingMonthly" key="loading" label="Cargando comparación..." />
            <MonthlyComparisonTable v-else key="table" :months="monthlyComparison" />
          </Transition>
        </div>
      </section>

      <p v-if="error" class="analytics-error" role="alert">{{ error }}</p>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Análisis?" @close="showHelpSheet = false">
      <p class="help-text">
        Aquí ves cómo te está yendo con tu plata: cuánto ganaste y gastaste este mes, cuánto ahorro llevas acumulado
        sumando mes a mes (no solo el neto de un mes suelto), en qué categorías se te va el dinero y cómo cambia cada
        una con el tiempo, y una comparación de los últimos meses. Todo se recalcula solo con tus movimientos
        registrados - no hay nada que cargar a mano acá.
      </p>
    </BottomSheet>
  </PageShell>
</template>

<style scoped>
.analytics-screen {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
}

.analytics-period {
  display: flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.help-text {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-muted);
}

/* Puntito "en vivo" junto a la fecha - mismo espiritu que el punto brillante
   del grafico de abajo (halo desenfocado + nucleo solido), pedido explicito
   del usuario de que la pantalla se sienta viva, no un dashboard estatico. */
.analytics-period-dot {
  position: relative;
  display: inline-flex;
  width: 0.5rem;
  height: 0.5rem;
  flex-shrink: 0;
}

.analytics-period-dot::before {
  content: '';
  position: absolute;
  inset: -0.1875rem;
  border-radius: var(--radius-pill);
  background: var(--accent);
  opacity: 0.35;
  filter: blur(3px);
}

.analytics-period-dot-core {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-pill);
  background: var(--accent);
}

.hero-section {
  margin-top: 1.25rem;
}

/* Tarjeta hero, a mano (no <BaseCard>) - mismo criterio que BalanceCard.vue
   en Inicio: el momento mas importante de la pantalla no comparte el mismo
   look plano que el resto de las tarjetas glass, se le agrega una linea de
   acento arriba (.hero-keyline) y mas aire. */
.hero-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  padding: 1.5rem 1.375rem 1.25rem;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .hero-card {
    background: var(--bg-raised);
  }
}

.hero-keyline {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--accent) 25%, var(--accent) 75%, transparent);
}

/* Apilado (no lado a lado) por default: en un telefono chico, la etiqueta
   mayuscula + el toggle 3M/6M/12M compitiendo por la misma fila hacia que
   la etiqueta se partiera en 3 lineas apretadas contra el toggle (bug real
   visto en vivo) - a partir de 480px ya entran los dos en una fila comoda. */
.hero-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.625rem;
  margin-bottom: 1rem;
}

@media (min-width: 480px) {
  .hero-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.hero-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-section {
  margin-top: 1rem;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.stat-card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  padding: 1rem 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .stat-card {
    background: var(--bg-surface);
  }
}

/* Tinte rojo apenas perceptible, solo en la tarjeta de Gastos - pedido
   explicito del usuario de que la pantalla no se sienta tan plana/pareja
   (3 cajas identicas en fila). El acento sigue reservado para gasto/negativo
   (nunca decorativo en otra tarjeta), asi que este tinte cae justo donde el
   resto de la app ya usa rojo. */
.stat-card.expense-tint {
  border-color: var(--accent-border);
  background: linear-gradient(155deg, rgba(239, 68, 68, 0.1), transparent 65%), var(--glass-bg);
}

.stat-card.net {
  grid-column: 1 / -1;
  gap: 0.375rem;
}

.stat-net-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.stat-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  /* Mismo alto que IconBadge size="sm" (2.25rem, ver IconBadge.vue) - fijado
     a mano en vez de dejar que lo determine el icono, para que el siguiente
     elemento (.stat-value) arranque siempre a la misma altura en las 3
     tarjetas del resumen. */
  min-height: 2.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
}

/* La tarjeta "Ahorro neto" no tiene IconBadge (no hay un icono neutro
   establecido para "neto") - sin este min-height, su etiqueta sola media
   mucho menos que el renglon icono+etiqueta de Ingresos/Gastos, y el monto
   de abajo quedaba mas arriba que el de esas otras dos tarjetas (bug real
   reportado por el usuario con captura, desalineado en escritorio). */
.stat-card.net > .stat-label {
  display: flex;
  align-items: center;
  min-height: 2.25rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-h);
}

.stat-value.expense {
  color: var(--accent);
}

.stat-delta {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

.stat-delta.expense {
  color: var(--accent);
}

.analytics-section {
  margin-top: 1.5rem;
}

/* min-height compartido (aproxima el alto real de .type-toggle: line-height
   1.6 heredado del body + su padding) entre .section-header (con toggle,
   ej. "Por categoría") y .section-title solo (sin toggle, ej. "Gastos por
   categoría, mes a mes") - sin esto, en el bento de escritorio las dos
   tarjetas de abajo arrancaban a distinta altura porque un encabezado con
   toggle mide mas que uno de solo texto (bug real reportado por el
   usuario con captura). */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.5rem;
  margin-bottom: 0.75rem;
}

.section-title {
  display: flex;
  align-items: center;
  min-height: 2.5rem;
  margin-bottom: 0.75rem;
  font-size: 1.0625rem;
}

.section-header .section-title {
  min-height: 0;
  margin-bottom: 0;
}

.glass-card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  padding: 1.5rem;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass-card {
    background: var(--bg-surface);
  }
}

.type-toggle {
  display: inline-flex;
  gap: 0.375rem;
  padding: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--bg-inset);
  border: 1px solid var(--glass-border);
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

/* Grid en escritorio: titulo y hero ocupando el ancho completo, resumen del
   mes debajo tambien completo, "Por categoría"+"su tendencia" lado a lado
   (comparten el toggle de Gastos/Ingresos), "Últimos N meses" de nuevo
   completo (el mini grafico de barras necesita el ancho para 12 columnas).
   ".error" queda como una fila extra que colapsa a 0 cuando no hay ningun
   elemento con esa grid-area. ":deep(.donut)" hace falta aca porque .donut
   NO es la raiz de CategoryPieChart.vue (es un <svg> anidado dentro de su
   propio div.category-pie-chart) - el mecanismo normal de "el padre alcanza
   la raiz del hijo" no llega mas alla de esa raiz, asi que sin :deep() esta
   regla no aplicaria. */
@media (min-width: 1024px) {
  .analytics-screen {
    max-width: 68rem;
    display: grid;
    grid-template-columns: 0.76fr 1.24fr;
    grid-template-areas:
      'title    title'
      'hero     hero'
      'summary  summary'
      'category trend'
      'monthly  monthly'
      'error    error';
    column-gap: 1.5rem;
    row-gap: 1.5rem;
    /* Sin esto, una columna mas baja (ej. "category", torta) se estira
       hasta igualar el alto de la de al lado (ej. "trend", lista de
       sparklines) o viceversa - mismo bug de stretch ya encontrado y
       arreglado en DashboardMain.vue. */
    align-items: start;
  }

  .analytics-period {
    grid-area: title;
    align-self: center;
  }

  .hero-section {
    grid-area: hero;
    margin-top: 0;
  }

  .hero-card {
    padding: 2rem 2.25rem 1.75rem;
  }

  .stat-section {
    grid-area: summary;
    margin-top: 0;
  }

  .stat-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .stat-card.net {
    grid-column: auto;
  }

  .stat-net-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .analytics-section:nth-of-type(3) {
    grid-area: category;
    margin-top: 0;
  }

  .analytics-section:nth-of-type(4) {
    grid-area: trend;
    margin-top: 0;
  }

  .analytics-section:nth-of-type(5) {
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
   "backwards" (nunca "both"/"forwards"): .stat-card es tambien objetivo de
   hover en la practica (mismo lenguaje glass que BaseCard.vue) - "forwards"
   congelaria su transform para siempre y el hover-lift dejaria de funcionar
   en silencio. */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .analytics-period {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .hero-section {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 50ms;
  }

  .stat-section {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 100ms;
  }

  .analytics-section:nth-of-type(3) {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 150ms;
  }

  .analytics-section:nth-of-type(4) {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 200ms;
  }

  .analytics-section:nth-of-type(5) {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 250ms;
  }
}
</style>
