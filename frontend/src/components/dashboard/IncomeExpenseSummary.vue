<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Draft, Transaction } from '../../services/transactions/interfaces/transactions.interface'
import { useAnalytics } from '../../composables/analytics/useAnalytics'
import { useOnboardingTour } from '../../composables/onboarding/useOnboardingTour'
import { useScrollIntoViewOnActive } from '../../composables/onboarding/useScrollIntoViewOnActive'
import { useAuthStore } from '../../stores/auth.store'
import { useTransactionsStore } from '../../stores/transactions.store'
import { useWalletsStore } from '../../stores/wallets.store'
import ReceiptUpload from '../receiptScanner/ReceiptUpload.vue'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import CoachMarkTooltip from '../ui/CoachMarkTooltip.vue'
import IconBadge from '../ui/IconBadge.vue'
import DraftReviewCard from '../transactions/DraftReviewCard.vue'
import TransactionForm from '../transactions/TransactionForm.vue'
import TransactionList from '../transactions/TransactionList.vue'
import VoiceEntryButton from '../voiceEntry/VoiceEntryButton.vue'

// Movimientos: ya no se piden con su propio listTransactions({dateFrom,
// dateTo}) - se leen de la cache compartida (transactions.store.ts,
// pedido explicito del usuario: "guardar los datos cargados en cache...
// asi cuando nos movamos de un lado a otro ya los montos esten
// cargados") y se filtra el mes actual aca mismo, en el cliente. Reutiliza
// TransactionList.vue (el mismo de Movimientos) para el detalle en el
// bottom sheet, solo que filtrado por tipo.
const transactionsStore = useTransactionsStore()
const loadError = ref<string | null>(null)
const activeSheet = ref<'income' | 'expense' | null>(null)
// Se muestra el form de alta con el tipo ya fijado segun cual box se toco -
// pedido explicito del usuario ("crear ingresos o gastos depende de cual le
// de click"). Se resetea a false cada vez que se abre/cierra el sheet.
const showAddForm = ref(false)
// Pedido explicito del usuario: poder editar un movimiento ya creado, tambien desde
// este sheet (mismo TransactionForm.vue que Movimientos). null = el form esta en modo
// creacion - ver onEditTransaction/closeAddForm mas abajo.
const editingTransaction = ref<Transaction | null>(null)
// Borradores creados por voz/OCR desde este sheet (mismo botones que
// Movimientos - pedido explicito del usuario). No son fetch del servidor
// como en TransactionsMain.vue: solo lo que se capture en esta sesion, asi
// que no se resetean al cerrar el sheet (un draft sin confirmar sigue
// pendiente igual en el backend y tambien aparece en "Borradores
// pendientes" de Movimientos si el usuario no vuelve a abrir Inicio).
const pendingDrafts = ref<Draft[]>([])

const authStore = useAuthStore()
const walletsStore = useWalletsStore()
// Misma moneda que ya usa AnalyticsMain.vue para sus totales (no
// currencyStore.displayCurrency, el selector manual de BalanceCard.vue) - el
// backend calcula getPeriodSummary() fijo a User.default_currency, asi que la
// etiqueta debe coincidir con eso. Efecto visible e intencional: el selector
// USD/EUR/USDT deja de afectar estas dos cajas, solo sigue afectando balances.
const displayCurrency = computed(() => authStore.user?.defaultCurrency ?? 'USD')
const { periodSummary, fetchPeriodSummary } = useAnalytics()
// Paso 2 del tour guiado de Inicio (ver BalanceCard.vue/useOnboardingTour.ts) -
// pedido explicito del usuario: al tocar "Continuar" en el paso del balance,
// sigue esta box.
const { currentStep, stepPosition, isFirstStep, isLastStep, next, back, close } = useOnboardingTour()
const showTourCoachMark = computed(() => currentStep.value?.id === 'income-expense')
const summaryRef = ref<HTMLElement | null>(null)
// Pedido explicito del usuario: cuando este paso se activa hay que
// scrollear hasta las boxes de Ingresos/Gastos (estan mas abajo que los
// accesos rapidos, que se explican DESPUES en el orden del tour) en vez de
// dejar el texto flotante aparecer fuera de pantalla.
useScrollIntoViewOnActive(summaryRef, showTourCoachMark)

function isThisMonth(occurredAt: string): boolean {
  const now = new Date()
  const date = new Date(occurredAt)
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

// Filtro en el cliente en vez de un listTransactions({dateFrom, dateTo})
// propio - la cache compartida (transactions.store.ts) guarda la lista
// completa sin parametros de fecha, asi que "el mes actual" se resuelve
// aca en vez de pedirselo de nuevo al backend.
//
// source !== 'transfer' excluye las dos patas que crea una transferencia
// entre wallets propias (ver transfer_service.py del backend) - mover
// plata de una cuenta a otra no es "ingreso" ni "gasto" real, solo
// inflaria ambos totales por igual sin que haya pasado nada financiero.
// La transferencia SI sigue apareciendo en el Historial de Movimientos
// (TransactionsMain.vue no filtra por source) - solo se excluye de estas
// dos boxes/su detalle.
const monthTransactions = computed(() =>
  transactionsStore.transactions.filter((t) => isThisMonth(t.occurredAt) && t.source !== 'transfer'),
)
const incomeTransactions = computed(() => monthTransactions.value.filter((t) => t.type === 'income'))
const expenseTransactions = computed(() => monthTransactions.value.filter((t) => t.type === 'expense'))

// Bug real reportado por el usuario, con captura: un gasto en una wallet en
// VEF se sumaba tal cual (monto crudo) junto con gastos en wallets USD/EUR/
// USDT, y el total se mostraba con la moneda de visualizacion actual como si
// TODO hubiera estado en esa moneda - ej. "5.560 VEF de gasto" aparecia como
// "$5,560.00". Antes esta caja recalculaba su propio total agrupando por
// moneda y convirtiendo con la tasa EN VIVO (ignorando la fecha real de cada
// movimiento) - un camino totalmente distinto al que ya usa Analisis
// (get_period_summary, tasa historica congelada por transaccion). Ahora las
// dos cajas simplemente piden el mismo resumen que ya usa Analisis, para que
// Inicio/Movimientos/Analisis muestren siempre el mismo numero.
const income = computed(() => periodSummary.value?.totalIncome ?? 0)
const expenses = computed(() => periodSummary.value?.totalExpense ?? 0)

const sheetTitle = computed(() => (activeSheet.value === 'income' ? 'Ingresos de este mes' : 'Gastos de este mes'))
const sheetTransactions = computed(() =>
  activeSheet.value === 'income' ? incomeTransactions.value : expenseTransactions.value,
)

onMounted(() => {
  transactionsStore.fetchTransactions().catch((error) => {
    loadError.value = error instanceof Error ? error.message : 'No se pudieron cargar los movimientos del mes.'
  })
  fetchPeriodSummary()
})

function openSheet(type: 'income' | 'expense') {
  activeSheet.value = type
  closeAddForm()
}

function closeSheet() {
  activeSheet.value = null
  closeAddForm()
}

function closeAddForm() {
  showAddForm.value = false
  editingTransaction.value = null
}

async function onDeleteTransaction(transactionId: string) {
  try {
    await transactionsStore.removeTransaction(transactionId)
    fetchPeriodSummary()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudo eliminar el movimiento.'
  }
}

function onTransactionCreated(transaction: Transaction) {
  transactionsStore.recordCreated(transaction)
  fetchPeriodSummary()
  closeAddForm()
}

// Sin conexion (o falla de red real) - TransactionForm.vue ya encolo el
// movimiento y avisa con un toast (ver offlineQueue.store.ts); aca solo hace
// falta cerrar el sheet, igual que si hubiera creado la transaction de una.
function onTransactionQueued() {
  closeAddForm()
}

function onEditTransaction(transaction: Transaction) {
  editingTransaction.value = transaction
  showAddForm.value = true
}

function onTransactionUpdated(transaction: Transaction) {
  transactionsStore.recordUpdated(transaction)
  fetchPeriodSummary()
  closeAddForm()
}

function onDraftCreated(draft: Draft) {
  pendingDrafts.value = [draft, ...pendingDrafts.value]
}

function onDraftConfirmed(transaction: Transaction, draftId: string) {
  transactionsStore.recordCreated(transaction)
  fetchPeriodSummary()
  // Bug real: filtraba por transaction.id, pero draft y transaction son
  // entidades distintas con ids distintos - la tarjeta nunca desaparecia
  // despues de confirmar (ver DraftReviewCard.vue, que ahora emite el
  // draftId explicito).
  pendingDrafts.value = pendingDrafts.value.filter((draft) => draft.id !== draftId)
}

function onDraftDiscarded(draftId: string) {
  pendingDrafts.value = pendingDrafts.value.filter((draft) => draft.id !== draftId)
}
</script>

<template>
  <div ref="summaryRef" class="income-expense-summary">
    <BaseCard
      :padded="false"
      :class="{ 'is-tour-active': showTourCoachMark }"
      class="summary-card clickable"
      role="button"
      tabindex="0"
      aria-haspopup="dialog"
      @click="openSheet('income')"
      @keydown.enter="openSheet('income')"
      @keydown.space.prevent="openSheet('income')"
    >
      <div class="summary-heading">
        <IconBadge variant="income" size="sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </IconBadge>
        <p class="summary-label">Ingresos</p>
      </div>
      <!-- Ingresos usa texto neutro (no verde): la paleta de Berry es
           negro+rojo, sin un segundo tono para "positivo" (ver style.css). -->
      <p class="summary-amount">
        <AnimatedCurrency :value="income" :currency="displayCurrency" direction="up" />
      </p>
    </BaseCard>

    <BaseCard
      :padded="false"
      :class="{ 'is-tour-active': showTourCoachMark }"
      class="summary-card clickable"
      role="button"
      tabindex="0"
      aria-haspopup="dialog"
      @click="openSheet('expense')"
      @keydown.enter="openSheet('expense')"
      @keydown.space.prevent="openSheet('expense')"
    >
      <div class="summary-heading">
        <IconBadge variant="expense" size="sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M6 13l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </IconBadge>
        <p class="summary-label">Gastos</p>
      </div>
      <p class="summary-amount expense">
        <AnimatedCurrency :value="expenses" :currency="displayCurrency" direction="down" />
      </p>
    </BaseCard>

    <p v-if="loadError" class="summary-error" role="alert">{{ loadError }}</p>

    <CoachMarkTooltip
      v-if="showTourCoachMark && currentStep"
      class="summary-coach-mark"
      :title="currentStep.title"
      :text="currentStep.text"
      :step-label="stepPosition"
      :show-back="!isFirstStep"
      :next-label="isLastStep ? 'Entendido' : 'Continuar'"
      @dismiss="close"
      @back="back"
      @next="next"
    />

    <BottomSheet v-if="activeSheet" :title="sheetTitle" @close="closeSheet">
      <div class="sheet-add-row">
        <button
          v-if="!showAddForm"
          type="button"
          class="sheet-add-trigger"
          @click="editingTransaction = null; showAddForm = true"
        >
          + Agregar {{ activeSheet === 'income' ? 'ingreso' : 'gasto' }}
        </button>
        <div class="capture-actions">
          <VoiceEntryButton @created="onDraftCreated" />
          <ReceiptUpload @created="onDraftCreated" />
        </div>
      </div>

      <TransactionForm
        v-if="showAddForm"
        class="sheet-add-form"
        :initial-type="activeSheet"
        :editing-transaction="editingTransaction"
        @created="onTransactionCreated"
        @updated="onTransactionUpdated"
        @queued="onTransactionQueued"
        @cancel="closeAddForm"
      />

      <div v-if="pendingDrafts.length > 0" class="sheet-drafts">
        <DraftReviewCard
          v-for="draft in pendingDrafts"
          :key="draft.id"
          :draft="draft"
          :initial-type="activeSheet ?? 'expense'"
          @confirmed="onDraftConfirmed"
          @discarded="onDraftDiscarded"
        />
      </div>

      <p v-if="sheetTransactions.length === 0" class="sheet-empty">
        No tienes {{ activeSheet === 'income' ? 'ingresos' : 'gastos' }} registrados este mes.
      </p>
      <TransactionList
        v-else
        :transactions="sheetTransactions"
        :wallets="walletsStore.wallets"
        @delete="onDeleteTransaction"
        @edit="onEditTransaction"
      />
    </BottomSheet>
  </div>
</template>

<style scoped>
.income-expense-summary {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.summary-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  /* Padding propio, mas chico que el default de BaseCard (:padded="false"
     arriba) - pedido explicito del usuario: "las dos box... son muy
     grandes, deben verse un poco mas minimalistas". */
  padding: 1rem;
  transition: box-shadow var(--duration-base) var(--ease-out);
}

/* Anillo rojo - mismo criterio que .tour-active de QuickActionsGrid.vue:
   pedido explicito del usuario ("señalar bien cual accion anda
   explicando"). Se marcan las dos boxes (el paso explica ambas juntas). */
.summary-card.is-tour-active {
  box-shadow: 0 0 0 2px var(--accent);
}

.summary-card.clickable {
  cursor: pointer;
  transition:
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.summary-card.clickable:hover {
  border-color: var(--border);
}

.summary-card.clickable:active {
  transform: scale(0.97);
  opacity: 0.85;
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

/* Flotante (position:absolute) - pedido explicito del usuario: antes con
   "grid-column: 1 / -1" ocupaba su propia fila del grid y empujaba el
   BottomSheet/PromoBanner de abajo. Al ser absoluto queda afuera del flujo
   del grid (no le suma alto al contenedor), asi que "top: 100%" cae justo
   debajo de las dos boxes sin desplazar nada. */
.summary-coach-mark {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  z-index: 5;
}

.summary-error {
  grid-column: 1 / -1;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.sheet-add-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.sheet-add-trigger {
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

.sheet-add-trigger:hover {
  opacity: 0.85;
}

.sheet-add-trigger:active {
  transform: scale(0.98);
  opacity: 0.75;
}

/* Botones de voz/foto (VoiceEntryButton/ReceiptUpload), mismo criterio que
   Movimientos: siempre visibles, independientes de si el form manual esta
   abierto - pedido explicito del usuario ("se pueda agregar la opcion de
   audio o foto asi como seria en movimientos"). */
.capture-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.sheet-drafts {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.sheet-add-form {
  margin-bottom: 1rem;
}

.sheet-empty {
  padding: 1.5rem 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}

@media (max-width: 380px) {
  .summary-amount {
    font-size: 1.15rem;
  }
}
</style>
