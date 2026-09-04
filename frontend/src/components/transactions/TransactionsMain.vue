<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCurrency } from '../../composables/currency/useCurrency'
import { useCurrencyStore } from '../../stores/currency.store'
import { useTransactionsStore } from '../../stores/transactions.store'
import { useWalletsStore } from '../../stores/wallets.store'
import { listDrafts } from '../../services/transactions/transactions.service'
import type { Draft, Transaction } from '../../services/transactions/interfaces/transactions.interface'
import type { TransferEditTarget } from '../../services/wallets/interfaces/wallets.interface'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import ReceiptUpload from '../receiptScanner/ReceiptUpload.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import MonthPager from '../ui/MonthPager.vue'
import VoiceEntryButton from '../voiceEntry/VoiceEntryButton.vue'
import TransferForm from '../wallets/TransferForm.vue'
import DraftReviewCard from './DraftReviewCard.vue'
import MonthSummaryCards from './MonthSummaryCards.vue'
import TransactionForm from './TransactionForm.vue'
import TransactionList from './TransactionList.vue'
import TransactionsFilterSheet, { DEFAULT_TRANSACTIONS_FILTER } from './TransactionsFilterSheet.vue'
import TransactionsFilterPanel from './TransactionsFilterPanel.vue'
import type { TransactionsFilterState } from './interfaces/TransactionsFilterSheet.interface'

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
const router = useRouter()
const walletsStore = useWalletsStore()
const transactionsStore = useTransactionsStore()
const currencyStore = useCurrencyStore()
const { convert } = useCurrency()

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

// source !== 'transfer' excluye las dos patas que crea una transferencia
// entre wallets propias (ver transfer_service.py del backend) de las boxes
// de Ingresos/Gastos - mover plata de una cuenta a otra no es ingreso ni
// gasto real. La transferencia SI sigue apareciendo en filteredTransactions
// (el Historial de abajo, pedido explicito del usuario) - solo se excluye
// de estos dos totales.
const monthTransactions = computed(() =>
  transactionsStore.transactions.filter(
    (t) => isInMonth(t.occurredAt, activeMonth.value.year, activeMonth.value.month) && t.source !== 'transfer',
  ),
)

// Bug real reportado por el usuario, con captura (mismo bug que ya se habia
// arreglado en IncomeExpenseSummary.vue de Inicio, pero en este archivo
// aparte - Movimientos tiene su propio calculo, nunca paso por ese fix): un
// gasto en una wallet en VEF se sumaba tal cual (monto crudo) junto con
// gastos en wallets USD/EUR/USDT, y el total se mostraba con la moneda de
// visualizacion actual como si TODO hubiera estado en esa moneda - ej.
// "31.187 VEF de gasto" aparecia como "31.187,00 €". Una Transaction no trae
// su propia moneda (solo wallet_id), asi que hay que resolverla por su
// wallet y convertir ANTES de sumar - agrupando por moneda presente este mes
// (una llamada por moneda distinta, no una por transaccion).
function walletCurrency(walletId: string): string {
  return walletsStore.wallets.find((wallet) => wallet.id === walletId)?.currency ?? currencyStore.displayCurrency
}

async function sumConverted(transactions: Transaction[]): Promise<number> {
  const target = currencyStore.displayCurrency
  const subtotalByCurrency = new Map<string, number>()
  for (const transaction of transactions) {
    const currency = walletCurrency(transaction.walletId)
    subtotalByCurrency.set(currency, (subtotalByCurrency.get(currency) ?? 0) + transaction.amount)
  }

  let total = 0
  for (const [currency, subtotal] of subtotalByCurrency) {
    if (currency === target) {
      total += subtotal
      continue
    }
    try {
      const result = await convert(subtotal, currency, target)
      total += result.convertedAmount
    } catch {
      // Best-effort, mismo criterio que BalanceCard.vue/IncomeExpenseSummary.vue: si
      // la conversion de ese grupo de moneda falla, no cuenta en el total en vez de
      // romper el resto del calculo.
    }
  }
  return total
}

const monthIncome = ref(0)
const monthExpenses = ref(0)

async function recomputeMonthTotals() {
  const income = monthTransactions.value.filter((t) => t.type === 'income')
  const expenses = monthTransactions.value.filter((t) => t.type === 'expense')
  monthIncome.value = await sumConverted(income)
  monthExpenses.value = await sumConverted(expenses)
}

watch(
  [monthTransactions, () => currencyStore.displayCurrency, () => walletsStore.wallets],
  recomputeMonthTotals,
  { immediate: true },
)

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
    // transferencia usan type income/expense pero no son ingreso/gasto
    // real - ver comentario de monthTransactions arriba). Al elegir
    // Ingresos/Gastos, las patas de transferencia quedan afuera por el
    // mismo motivo (mismo criterio que las boxes de resumen).
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

function onTransactionCreated(transaction: Transaction) {
  transactionsStore.recordCreated(transaction)
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
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudo eliminar el movimiento.'
  }
}

function onDraftConfirmed(transaction: Transaction, draftId: string) {
  transactionsStore.recordCreated(transaction)
  drafts.value = drafts.value.filter((draft) => draft.id !== draftId)
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

    <div class="transactions-main">
      <!-- Wrapper divs (columnas independientes de escritorio, ver
           @media min-width:1024px) - mismo criterio que DashboardMain.vue:
           con grid-column simple + auto-placement (como estaba antes) el
           auto-placement de CSS Grid seguia emparejando filters-sidebar
           (muy alto, todo el panel de filtros) con "Historial" en la MISMA
           fila del grid (coincidencia del orden del DOM), dejando un hueco
           vacio real antes de que "Historial" pudiera empezar. En
           mobile/tablet estos divs son bloques transparentes sin estilo
           propio, el flujo se ve identico a como era antes. -->
      <div class="transactions-col transactions-col-sidebar">
        <div class="month-pager-row">
          <MonthPager :year="activeMonth.year" :month="activeMonth.month" @change="onMonthChange" />
        </div>

        <MonthSummaryCards
          class="transactions-section"
          :income="monthIncome"
          :expenses="monthExpenses"
          :currency="currencyStore.displayCurrency"
        />

        <!-- Solo visible en escritorio (ver @media min-width:1024px abajo) -
             en mobile/tablet los mismos filtros siguen viviendo en el
             TransactionsFilterSheet de mas abajo, sin cambios. -->
        <aside class="filters-sidebar">
          <TransactionsFilterPanel :model-value="filter" :categories="categories" @apply="onFilterApply" />
        </aside>
      </div>

      <div class="transactions-col transactions-col-main">
        <div class="transactions-section capture-row">
          <button type="button" class="new-transaction-trigger" @click="showCreateSheet = true">
            + Nuevo movimiento
          </button>
          <VoiceEntryButton @created="onDraftCreated" />
          <ReceiptUpload @created="onDraftCreated" />
        </div>

        <div v-if="drafts.length > 0" class="transactions-section drafts-list">
          <DraftReviewCard
            v-for="draft in drafts"
            :key="draft.id"
            :draft="draft"
            @confirmed="onDraftConfirmed"
            @discarded="onDraftDiscarded"
          />
        </div>

        <div class="transactions-section search-row">
          <input
            v-model="searchQuery"
            type="search"
            class="search-input"
            placeholder="Buscar por categoría o descripción..."
          />
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
        </div>

        <p v-if="loadError" class="transactions-error" role="alert">{{ loadError }}</p>

        <section class="transactions-section">
          <h2 class="section-title">Historial</h2>
          <Transition name="loading-fade" mode="out-in">
            <LoadingIndicator
              v-if="transactionsStore.isLoading && transactionsStore.transactions.length === 0"
              key="loading"
              label="Cargando movimientos..."
            />
            <BaseCard v-else-if="filteredTransactions.length === 0" key="empty" class="transactions-empty">
              <p class="transactions-empty-text">No tienes movimientos que coincidan con estos filtros.</p>
            </BaseCard>
            <TransactionList
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

<style scoped>
.transactions-main {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
}

.month-pager-row {
  display: flex;
  justify-content: center;
}

.filters-sidebar {
  display: none;
}

.transactions-section {
  margin-top: 1.5rem;
}

.section-title {
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.capture-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.new-transaction-trigger {
  flex: 1;
  padding: 0.75rem;
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.new-transaction-trigger:hover {
  opacity: 0.85;
}

.new-transaction-trigger:active {
  transform: scale(0.98);
  opacity: 0.75;
}

.drafts-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  /* 1rem, no menos: por debajo de 16px iOS Safari hace zoom automatico al
     enfocar un input - pedido explicito del usuario ("ningun input debe
     hacer que el tlf haga zoom"), rompe la sensacion de app nativa. */
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.filter-trigger {
  position: relative;
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
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.filter-trigger svg {
  width: 1.125rem;
  height: 1.125rem;
}

.filter-trigger:active {
  transform: scale(0.94);
}

.filter-trigger.has-active-filter {
  border-color: var(--accent-border);
  color: var(--accent);
}

.filter-trigger-dot {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--accent);
}

.transactions-error {
  margin-top: 1.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.transactions-empty {
  text-align: center;
  color: var(--text-muted);
}

.transactions-empty-text {
  font-size: 0.8125rem;
  line-height: 1.5;
}

.help-text {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-muted);
}

/* En escritorio los filtros pasan de bottom sheet a sidebar siempre visible
   (pedido explicito del usuario de layout multi-columna). Cada columna es
   su propio stack independiente (.transactions-col, ver template) - se
   probo antes con grid-column simple + auto-placement de CSS Grid (sin
   wrapper), pero el auto-placement seguia emparejando filters-sidebar (muy
   alto, todo el panel de filtros) con "Historial" en la MISMA fila
   compartida del grid por simple coincidencia del orden del DOM, dejando un
   hueco vacio real antes de que "Historial" pudiera empezar - mismo bug de
   fondo (filas de grid compartidas entre columnas de alturas muy distintas)
   que ya se encontro en DashboardMain.vue. */
@media (min-width: 1024px) {
  .transactions-main {
    max-width: 76rem;
    display: grid;
    grid-template-columns: 20rem 1fr;
    column-gap: 2rem;
    align-items: start;
  }

  .transactions-col {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .transactions-col-sidebar {
    grid-column: 1;
  }

  .transactions-col-main {
    grid-column: 2;
  }

  /* Mismo alto minimo en ".month-pager-row" y ".capture-row" (el pager mide
     ~36px de alto natural, el boton "+ Nuevo movimiento" ~46px) para que
     Ingresos/Gastos (debajo del pager, columna izquierda) arranque a la
     misma altura que el buscador (debajo de "+ Nuevo movimiento", columna
     derecha) - pedido explicito del usuario. Ambas columnas siguen siendo
     independientes entre si (align-items:start en ".transactions-main"),
     esto solo empareja el alto de la PRIMERA fila de cada una. */
  .month-pager-row {
    justify-content: flex-start;
    align-items: center;
    min-height: 2.75rem;
  }

  .capture-row {
    min-height: 2.75rem;
  }

  /* El spacing entre items de cada columna ahora lo da ".transactions-col"
     (gap:1.5rem) - sin resetear esto a 0 quedaria doble espacio (margin +
     gap) entre cada elemento. */
  .transactions-section,
  .transactions-error {
    margin-top: 0;
  }

  .filters-sidebar {
    display: block;
  }

  .section-title {
    font-size: 1.375rem;
  }

  .filter-trigger {
    display: none;
  }

  .filter-sheet {
    display: none;
  }
}

/* Animacion de entrada al cargar Movimientos en escritorio - bloque
   separado, con guard extra de prefers-reduced-motion. "section.
   transactions-section" (el wrapper de Historial/TransactionList) queda
   deliberadamente afuera: envuelve una lista que ya tiene su propio stagger
   via TransitionGroup + appear (ver TransactionList.vue) - animar tambien el
   wrapper la dejaria escondida detras del delay del padre. */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .month-pager-row {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .month-summary-cards {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 50ms;
  }

  .filters-sidebar {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 100ms;
  }

  .capture-row {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 150ms;
  }
}
</style>
