<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCollapseTransition } from '../../animation/useCollapseTransition'
import { useFadeTransition } from '../../animation/useFadeTransition'
import { vPress } from '../../animation/vPress'
import { useStaggerReveal } from '../../animation/useStaggerReveal'
import { useQuickRegister } from '../../composables/quickRegister/useQuickRegister'
import { useAnalytics } from '../../composables/analytics/useAnalytics'
import { useAuthStore } from '../../stores/auth.store'
import { useTransactionsStore } from '../../stores/transactions.store'
import { useWalletsStore } from '../../stores/wallets.store'
import { listDrafts } from '../../services/transactions/transactions.service'
import type { Draft, Transaction } from '../../services/transactions/interfaces/transactions.interface'
import type { TransferEditTarget } from '../../services/wallets/interfaces/wallets.interface'
import { toPeriodKey } from '../../utils/formatters/formatPeriod'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import ReceiptUpload from '../receiptScanner/ReceiptUpload.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import MonthPager from '../ui/MonthPager.vue'
import VoiceEntryButton from '../voiceEntry/VoiceEntryButton.vue'
import CaptureEntryButton from '../screenshotScan/CaptureEntryButton.vue'
import TransferForm from '../wallets/TransferForm.vue'
import CategoryBreakdownCard from './CategoryBreakdownCard.vue'
import CategoryChips from './CategoryChips.vue'
import DraftReviewCard from './DraftReviewCard.vue'
import DraftsBanner from './DraftsBanner.vue'
import MonthSummaryCards from './MonthSummaryCards.vue'
import TransactionForm from './TransactionForm.vue'
import TransactionHistory from './TransactionHistory.vue'
import TransactionsFilterSheet, { DEFAULT_TRANSACTIONS_FILTER } from './TransactionsFilterSheet.vue'
import TransactionsFilterPanel from './TransactionsFilterPanel.vue'
import TransactionTypeChips from './TransactionTypeChips.vue'
import type { TransactionsFilterState, TransactionTypeFilter } from './interfaces/TransactionsFilterSheet.interface'

// Pantalla "Movimientos" (/movimientos) - rediseñada segun dos capturas de
// referencia que compartio el usuario (layout nada mas, la paleta sigue
// negro+rojo propia de Berry): header con volver+titulo+ayuda, pager de
// mes, boxes de Ingresos/Gastos del mes activo, busqueda+filtros, y "nuevo
// movimiento"/voz/foto abren como bottom sheet - "todo esto es muy
// reutilizable" (pedido explicito del usuario), de ahi que MonthPager.vue,
// PillToggle.vue y BottomSheet.vue sean piezas genericas en components/ui/.
//
// El ledger se lee de la cache compartida (transactions.store.ts) y el
// filtro por mes/tipo/periodo/categoria/busqueda se resuelve ENTERO en el
// cliente (computed abajo) - no hay pedidos nuevos al backend por cambiar de
// mes o tocar un filtro.
// Entrada escalonada de las secciones marcadas con data-reveal (Motion, ver
// animation/useStaggerReveal.ts) - mismo recurso que ya usa Inicio.
const mainRef = ref<HTMLElement | null>(null)
useStaggerReveal(mainRef, { spring: true, rise: 10, step: 0.06 })

// Aparecer/desaparecer fluido (Motion): bloques que empujan al resto (error, pendientes)
// animan su alto; los que reemplazan a otro (cargando -> lista -> vacio) hacen fundido.
const collapse = useCollapseTransition()
const fade = useFadeTransition()

const router = useRouter()
const quickRegister = useQuickRegister()
const walletsStore = useWalletsStore()
const transactionsStore = useTransactionsStore()
const authStore = useAuthStore()
// Misma moneda que ya usa AnalyticsMain.vue (no currencyStore.displayCurrency, el
// selector manual de BalanceCard.vue) - el backend calcula getPeriodSummary() fijo a
// User.default_currency, la etiqueta debe coincidir con eso. Efecto intencional: el
// selector USD/EUR/USDT deja de afectar estas cajas, solo balances.
const displayCurrency = computed(() => authStore.user?.defaultCurrency ?? 'USD')
const { periodSummary, fetchPeriodSummary, categoryBreakdown, fetchCategoryBreakdown } = useAnalytics()

const drafts = ref<Draft[]>([])
const loadError = ref<string | null>(null)
const showCreateSheet = ref(false)
// Pedido explicito del usuario: poder editar un movimiento ya creado. null = el sheet
// esta en modo creacion (comportamiento de siempre) - ver onEditTransaction/
// closeCreateSheet mas abajo.
const editingTransaction = ref<Transaction | null>(null)
// Edicion de una transferencia (monto/comision/fecha) - pedido explicito del
// usuario. Sheet propio, separado del de arriba: TransferForm.vue no
// comparte campos con TransactionForm.vue (billeteras origen/destino,
// comision, monto convertido) y la creacion de transferencias sigue
// viviendo en Cuentas (WalletsMain.vue) - esto solo cubre editar una ya
// existente, ver TransactionList.vue ("Editar" en una transferencia
// fusionada).
const editingTransfer = ref<TransferEditTarget | null>(null)
const showHelpSheet = ref(false)
const showFilterSheet = ref(false)
const draftsExpanded = ref(false)
const searchQuery = ref('')
const filter = ref<TransactionsFilterState>({ ...DEFAULT_TRANSACTIONS_FILTER })

const today = new Date()
const activeMonth = ref({ year: today.getFullYear(), month: today.getMonth() })

async function loadAll() {
  loadError.value = null
  try {
    const [, draftsResult] = await Promise.all([transactionsStore.fetchTransactions(), listDrafts('pending')])
    drafts.value = draftsResult
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudieron cargar los movimientos.'
  }
}

onMounted(() => {
  walletsStore.fetchWallets().catch(() => {
    // Error ya reflejado en walletsStore.error; el picker de wallets del
    // form simplemente queda vacio.
  })
  loadAll()
})

function isInMonth(occurredAt: string, year: number, month: number): boolean {
  const date = new Date(occurredAt)
  return date.getFullYear() === year && date.getMonth() === month
}

// Bug real reportado por el usuario, con captura (mismo bug que ya se habia
// arreglado en IncomeExpenseSummary.vue de Inicio, pero en este archivo
// aparte - Movimientos tenia su propio calculo, nunca paso por ese fix): un
// gasto en una wallet en VEF se sumaba tal cual (monto crudo) junto con
// gastos en wallets USD/EUR/USDT, y el total se mostraba con la moneda de
// visualizacion actual como si TODO hubiera estado en esa moneda - ej.
// "31.187 VEF de gasto" aparecia como "31.187,00 €". Ahora esta caja pide el
// mismo resumen que ya usa Analisis (get_period_summary, tasa historica
// congelada por transaccion) para el mes activo del pager, en vez de
// recalcular su propio total con la tasa EN VIVO - asi Movimientos/Inicio/
// Analisis siempre muestran el mismo numero.
const monthIncome = computed(() => periodSummary.value?.totalIncome ?? 0)
const monthExpenses = computed(() => periodSummary.value?.totalExpense ?? 0)

// Resumen del mes + desglose de gastos por categoria (panel "En qué se fue el mes" y
// chips de categoria): mismo mes activo, mismas reglas de conversion del backend.
function refreshMonthStats(periodKey: string) {
  fetchPeriodSummary(periodKey)
  fetchCategoryBreakdown('expense', periodKey)
}

watch(activeMonth, (month) => refreshMonthStats(toPeriodKey(month.year, month.month)), { immediate: true })

// Un movimiento registrado desde el panel "Registrar" global entra a la cache
// compartida: el resumen del mes activo se vuelve a pedir para reflejarlo.
watch(
  () => transactionsStore.transactions.length,
  (_length, previousLength) => {
    if (previousLength > 0) refreshMonthStats(currentPeriodKey())
  },
)

// "N movimientos este mes" de las tarjetas de Ingresos/Gastos (escritorio): cuenta de
// movimientos reales del mes activo, sin las patas de transferencia.
const monthIncomeCount = computed(() => countMonthTransactions('income'))
const monthExpenseCount = computed(() => countMonthTransactions('expense'))

function countMonthTransactions(type: 'income' | 'expense'): number {
  return transactionsStore.transactions.filter(
    (t) =>
      t.type === type && t.source !== 'transfer' && isInMonth(t.occurredAt, activeMonth.value.year, activeMonth.value.month),
  ).length
}

// Chips de categoria dinamicos: Berry no tiene una taxonomia fija (ver
// TransactionsFilterSheet.vue) - se derivan de las categorias que el
// usuario ya uso de verdad, ordenadas para que la lista no "salte" cada vez
// que se crea un movimiento nuevo.
const categories = computed(() => Array.from(new Set(transactionsStore.transactions.map((t) => t.category))).sort())

const hasActiveFilter = computed(
  () => filter.value.type !== 'all' || filter.value.period !== 'month' || filter.value.category !== null,
)

const filteredTransactions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return transactionsStore.transactions.filter((t) => {
    if (filter.value.period === 'month') {
      if (!isInMonth(t.occurredAt, activeMonth.value.year, activeMonth.value.month)) return false
    } else {
      const days = Number(filter.value.period)
      const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000
      if (new Date(t.occurredAt).getTime() < cutoffMs) return false
    }

    // "transfer" filtra por source, no por type (las 2 patas de una
    // transferencia usan type income/expense pero no son ingreso/gasto real -
    // mover plata entre wallets propias no es ni ingreso ni gasto, mismo
    // criterio que excluye source==="transfer" en get_period_summary del
    // backend). Al elegir Ingresos/Gastos, las patas de transferencia quedan
    // afuera por el mismo motivo.
    if (filter.value.type === 'transfer') {
      if (t.source !== 'transfer') return false
    } else if (filter.value.type !== 'all') {
      if (t.type !== filter.value.type || t.source === 'transfer') return false
    }
    if (filter.value.category && t.category !== filter.value.category) return false

    if (query) {
      const matchesCategory = t.category.toLowerCase().includes(query)
      const matchesDescription = (t.description ?? '').toLowerCase().includes(query)
      if (!matchesCategory && !matchesDescription) return false
    }

    return true
  })
})

function onMonthChange(year: number, month: number) {
  activeMonth.value = { year, month }
}

function onFilterApply(next: TransactionsFilterState) {
  filter.value = next
}

function onCategoryChange(category: string | null) {
  filter.value = { ...filter.value, category }
}

// "Nuevo movimiento" abre el MISMO panel "Registrar" que el "+" de la barra flotante:
// primero pregunta como registrarlo (escribir, voz, recibo o capturas) y nace del
// boton que lo abrio. El sheet de abajo queda solo para EDITAR un movimiento.
function openRegisterPanel(event: MouseEvent) {
  quickRegister.open(event.currentTarget as Element)
}

function onTypeChange(type: TransactionTypeFilter) {
  filter.value = { ...filter.value, type }
}

function currentPeriodKey(): string {
  return toPeriodKey(activeMonth.value.year, activeMonth.value.month)
}

function onTransactionCreated(transaction: Transaction) {
  transactionsStore.recordCreated(transaction)
  refreshMonthStats(currentPeriodKey())
  closeCreateSheet()
}

// Sin conexion (o falla de red real) - TransactionForm.vue ya encolo el
// movimiento y avisa con un toast (ver offlineQueue.store.ts); aca solo hace
// falta cerrar el sheet, igual que si hubiera creado la transaction de una.
function onTransactionQueued() {
  closeCreateSheet()
}

// Edicion de un movimiento existente - pedido explicito del usuario. El MISMO sheet/
// form de creacion sirve para editar (ver TransactionForm.vue): "Editar" en
// TransactionList.vue precarga editingTransaction y abre el sheet; al guardar u
// cancelar, se limpia de nuevo para que "+ Nuevo movimiento" no arranque con datos
// viejos.
function onEditTransaction(transaction: Transaction) {
  editingTransaction.value = transaction
  showCreateSheet.value = true
}

function onTransactionUpdated(transaction: Transaction) {
  transactionsStore.recordUpdated(transaction)
  refreshMonthStats(currentPeriodKey())
  closeCreateSheet()
}

function closeCreateSheet() {
  showCreateSheet.value = false
  editingTransaction.value = null
}

function onEditTransfer(target: TransferEditTarget) {
  editingTransfer.value = target
}

function closeTransferEditSheet() {
  editingTransfer.value = null
}

async function onDeleteTransaction(transactionId: string) {
  try {
    await transactionsStore.removeTransaction(transactionId)
    refreshMonthStats(currentPeriodKey())
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudo eliminar el movimiento.'
  }
}

function onDraftConfirmed(transaction: Transaction, draftId: string) {
  transactionsStore.recordCreated(transaction)
  refreshMonthStats(currentPeriodKey())
  drafts.value = drafts.value.filter((draft) => draft.id !== draftId)
}

// Un pendiente completado como transferencia ya movio saldos y creo sus movimientos: se refresca todo.
function onDraftTransferred(draftId: string) {
  drafts.value = drafts.value.filter((draft) => draft.id !== draftId)
  transactionsStore.fetchTransactions({ force: true })
  refreshMonthStats(currentPeriodKey())
}

function onDraftDiscarded(draftId: string) {
  drafts.value = drafts.value.filter((draft) => draft.id !== draftId)
}

function onDraftCreated(draft: Draft) {
  drafts.value = [draft, ...drafts.value]
}

function goBack() {
  router.push({ name: 'dashboard' })
}
</script>

<template>
  <PageShell>
    <SectionHeader title="Movimientos" @back="goBack" @help="showHelpSheet = true" />

    <!-- Movil: una columna (resumen con el pager adentro, registrar, pendientes,
         busqueda+filtros, historial). Escritorio (grid, ver transactionsMain.css):
         barra superior con pager+registrar, tres tarjetas de resumen y debajo
         historial a la izquierda / panel lateral (pendientes, desglose, filtros)
         a la derecha. -->
    <div ref="mainRef" class="transactions-main">
      <div class="tx-toolbar" data-reveal>
        <MonthPager
          class="tx-toolbar-pager"
          variant="toolbar"
          :year="activeMonth.year"
          :month="activeMonth.month"
          @change="onMonthChange"
        />

        <div class="capture-row">
          <VoiceEntryButton label="Voz" @created="onDraftCreated" />
          <ReceiptUpload label="Recibo" @created="onDraftCreated" />
          <CaptureEntryButton label="Captura" />
          <button v-press="0.96" type="button" class="new-transaction-trigger" @click="openRegisterPanel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
            Nuevo movimiento
          </button>
        </div>
      </div>

      <MonthSummaryCards
        class="tx-hero"
        data-reveal
        :income="monthIncome"
        :expenses="monthExpenses"
        :currency="displayCurrency"
        :month-stamp="activeMonth.year * 12 + activeMonth.month"
        :income-count="monthIncomeCount"
        :expense-count="monthExpenseCount"
      >
        <template #pager>
          <MonthPager variant="hero" :year="activeMonth.year" :month="activeMonth.month" @change="onMonthChange" />
        </template>
      </MonthSummaryCards>

      <aside class="tx-aside" data-reveal>
        <DraftsBanner :count="drafts.length" :expanded="draftsExpanded" @toggle="draftsExpanded = !draftsExpanded">
          <TransitionGroup tag="div" class="drafts-list" :css="false" @enter="collapse.onEnter" @leave="collapse.onLeave">
            <DraftReviewCard
              v-for="draft in drafts"
              :key="draft.id"
              :draft="draft"
              @confirmed="onDraftConfirmed"
              @transferred="onDraftTransferred"
              @discarded="onDraftDiscarded"
            />
          </TransitionGroup>
        </DraftsBanner>

        <CategoryBreakdownCard
          class="tx-aside-desktop"
          :breakdown="categoryBreakdown"
          :currency="displayCurrency"
          :selected="filter.category"
          @select="onCategoryChange"
        />

        <!-- Solo visible en escritorio - en movil los mismos filtros viven en el
             TransactionsFilterSheet de mas abajo. -->
        <section class="tx-aside-desktop filters-card">
          <h2 class="filters-card-title">Filtros</h2>
          <TransactionsFilterPanel hide-type :model-value="filter" :categories="categories" @apply="onFilterApply" />
        </section>
      </aside>

      <div class="tx-primary">
        <div class="search-row" data-reveal>
          <label class="search-field">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" stroke-linecap="round" />
            </svg>
            <input
              v-model="searchQuery"
              type="search"
              class="search-input"
              aria-label="Buscar movimientos"
              placeholder="Buscar movimientos"
            />
          </label>
          <button
            type="button"
            class="filter-trigger"
            :class="{ 'has-active-filter': hasActiveFilter }"
            aria-label="Filtros"
            @click="showFilterSheet = true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M7 12h10M10 18h4" stroke-linecap="round" />
            </svg>
            <span v-if="hasActiveFilter" class="filter-trigger-dot" aria-hidden="true" />
          </button>
          <TransactionTypeChips class="type-chips-row" :model-value="filter.type" @update:model-value="onTypeChange" />
        </div>

        <CategoryChips
          class="category-chips-row"
          data-reveal
          :breakdown="categoryBreakdown"
          :currency="displayCurrency"
          :model-value="filter.category"
          @update:model-value="onCategoryChange"
        />

        <Transition :css="false" @enter="collapse.onEnter" @leave="collapse.onLeave">
          <p v-if="loadError" class="transactions-error" role="alert">{{ loadError }}</p>
        </Transition>

        <section class="history-section">
          <Transition
            mode="out-in"
            :css="false"
            @before-enter="fade.onBeforeEnter"
            @enter="fade.onEnter"
            @leave="fade.onLeave"
          >
            <LoadingIndicator
              v-if="transactionsStore.isLoading && transactionsStore.transactions.length === 0"
              key="loading"
              label="Cargando movimientos..."
            />
            <BaseCard v-else-if="filteredTransactions.length === 0" key="empty" class="transactions-empty">
              <p class="transactions-empty-text">No tienes movimientos que coincidan con estos filtros.</p>
            </BaseCard>
            <TransactionHistory
              v-else
              key="list"
              :transactions="filteredTransactions"
              :wallets="walletsStore.wallets"
              @delete="onDeleteTransaction"
              @edit="onEditTransaction"
              @edit-transfer="onEditTransfer"
            />
          </Transition>
        </section>
      </div>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Movimientos?" @close="showHelpSheet = false">
      <p class="help-text">
        Aquí vas a encontrar todo tu historial de ingresos y gastos. Navega entre meses con las flechas de arriba,
        agrega un movimiento nuevo a mano, por voz o con una foto del recibo, y usa la búsqueda o los filtros para
        encontrar algo puntual.
      </p>
    </BottomSheet>

    <BottomSheet
      v-if="showCreateSheet"
      :title="editingTransaction ? 'Editar movimiento' : 'Registrar movimiento'"
      @close="closeCreateSheet"
    >
      <TransactionForm
        :editing-transaction="editingTransaction"
        @created="onTransactionCreated"
        @updated="onTransactionUpdated"
        @queued="onTransactionQueued"
        @cancel="closeCreateSheet"
      />
    </BottomSheet>

    <BottomSheet v-if="editingTransfer" title="Editar transferencia" @close="closeTransferEditSheet">
      <TransferForm :editing-transfer="editingTransfer" @updated="closeTransferEditSheet" @cancel="closeTransferEditSheet" />
    </BottomSheet>

    <TransactionsFilterSheet
      v-if="showFilterSheet"
      class="filter-sheet"
      :model-value="filter"
      :categories="categories"
      @apply="onFilterApply"
      @close="showFilterSheet = false"
    />
  </PageShell>
</template>

<style scoped src="./transactionsMain.css"></style>
