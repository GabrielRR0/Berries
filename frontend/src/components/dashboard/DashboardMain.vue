<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStaggerReveal } from '../../animation/useStaggerReveal'
import { useAvatarInitials } from '../../composables/auth/useAvatarInitials'
import { useGreeting } from '../../composables/auth/useGreeting'
import { useScrollHeader } from '../../composables/layout/useScrollHeader'
import { useSectionActive } from '../../composables/navigation/sectionContext'
import { useOnboardingTour } from '../../composables/onboarding/useOnboardingTour'
import TopHeader from '../layout/TopHeader.vue'
import { useTransactionsStore } from '../../stores/transactions.store'
import { formatMonthName } from '../../utils/formatters/formatDate'
import { useWalletsStore } from '../../stores/wallets.store'
import PageShell from '../layout/PageShell.vue'
import BaseCard from '../ui/BaseCard.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import TransactionList from '../transactions/TransactionList.vue'
import BalanceCard from './BalanceCard.vue'
import IncomeExpenseSummary from './IncomeExpenseSummary.vue'
import QuickActionsGrid from './QuickActionsGrid.vue'
import WalletsCarousel from './WalletsCarousel.vue'

// Pantalla "Inicio" - la carga real de wallets ocurre dentro de
// BalanceCard.vue (que se monta como hijo de esta misma pantalla), asi que
// la seccion "Mis balances" de aca abajo solo LEE el wallets.store
// compartido (Pinia es singleton) en vez de volver a pedir la lista.
const walletsStore = useWalletsStore()
// Idea de la sesion de brainstorm de UI: antes la unica forma de ver
// movimientos desde Inicio era abrir el sheet de Ingresos/Gastos (varios
// taps). Misma logica de "solo leer, no volver a pedir" que la seccion de
// wallets de arriba - IncomeExpenseSummary.vue (hijo de esta misma pantalla)
// ya hace fetchTransactions() en su propio onMounted, esto solo lee la
// cache compartida (transactions.store.ts).
const transactionsStore = useTransactionsStore()
const RECENT_TRANSACTIONS_LIMIT = 5
const recentTransactions = computed(() =>
  [...transactionsStore.transactions]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, RECENT_TRANSACTIONS_LIMIT),
)

const router = useRouter()
const monthName = formatMonthName()
// Entrada escalonada de las secciones marcadas con data-reveal (Motion, ver
// animation/useStaggerReveal.ts).
const dashboardRef = ref<HTMLElement | null>(null)
useStaggerReveal(dashboardRef)
const { start: startTour, close: closeTour } = useOnboardingTour()
const avatarInitials = useAvatarInitials()
const { greeting, firstName } = useGreeting()
const { isScrolled } = useScrollHeader()

function goToWallets() {
  router.push({ name: 'cuentas' })
}

// TopHeader vive dentro de Inicio (no en App.vue): en el paginador de
// secciones se desliza junto con esta pagina, en vez de quedar flotando
// encima de Movimientos mientras se arrastra.
function goToSettings() {
  router.push({ name: 'ajustes' })
}

// Si el usuario se va a otra seccion con el tour a mitad de camino, se
// cierra - sin esto, al volver a Inicio reapareceria el mismo paso donde
// quedo. En el paginador Inicio puede seguir montada como vecina (fuera de
// pantalla), por eso no alcanza con onUnmounted.
const isActive = useSectionActive()
watch(isActive, (active) => {
  if (!active) closeTour()
})
onUnmounted(closeTour)
</script>

<template>
  <PageShell>
    <TopHeader
      :avatar-initials="avatarInitials"
      :greeting="greeting"
      :name="firstName"
      :scrolled="isScrolled"
      @avatar-click="goToSettings"
      @help-click="startTour"
    />

    <div ref="dashboardRef" class="dashboard">
      <!-- Wrapper divs - cada columna de escritorio es su propio stack
           independiente (ver @media min-width:1024px). En mobile/tablet
           son bloques transparentes sin estilo propio, el flujo se ve
           identico a como era antes. -->
      <div class="dashboard-col dashboard-col-primary">
        <BalanceCard class="dashboard-section" data-reveal />
        <QuickActionsGrid class="dashboard-section" data-reveal />
      </div>

      <div class="dashboard-col dashboard-col-secondary">
        <section class="dashboard-section month-section" data-reveal>
          <div class="recent-header">
            <h2 class="recent-title">{{ monthName }}</h2>
            <RouterLink to="/analitica" class="recent-view-all">Ver análisis</RouterLink>
          </div>
          <IncomeExpenseSummary />
        </section>

        <section class="dashboard-section recent-section" data-reveal>
          <div class="recent-header">
            <h2 class="recent-title">Últimos movimientos</h2>
            <RouterLink to="/movimientos" class="recent-view-all">Ver todos →</RouterLink>
          </div>

          <Transition name="loading-fade" mode="out-in">
            <LoadingIndicator
              v-if="transactionsStore.isLoading && transactionsStore.transactions.length === 0"
              key="loading"
              label="Cargando movimientos..."
            />
            <BaseCard v-else-if="recentTransactions.length === 0" key="empty" class="recent-empty">
              <p class="recent-empty-text">Todavía no registraste ningún movimiento.</p>
            </BaseCard>

            <TransactionList
              v-else
              key="list"
              :transactions="recentTransactions"
              :wallets="walletsStore.wallets"
              readonly
            />
          </Transition>
        </section>

        <WalletsCarousel
          class="dashboard-section wallets-section"
          data-reveal
          :wallets="walletsStore.wallets"
          :is-loading="walletsStore.isLoading"
          @open="goToWallets"
        />
      </div>
    </div>
  </PageShell>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
}

.dashboard-section {
  margin-top: 2rem;
}

.dashboard-section:first-child {
  margin-top: 1rem;
}

/* IncomeExpenseSummary ahora es tambien ":first-child" pero de
   .dashboard-col-secondary (su propio padre nuevo), asi que la regla de
   arriba lo agarraria por error con margin-top:1rem en vez de 2rem - esta
   regla, mas especifica, lo corrige sin tocar la regla original (que sigue
   aplicando tal cual para BalanceCard, primer hijo real de la pantalla). */
.dashboard-col-secondary > .dashboard-section:first-child {
  margin-top: 2rem;
}

/* En escritorio se reparte en 2 columnas tipo dashboard (pedido explicito
   del usuario). Cada columna es su propio stack independiente
   (.dashboard-col, ver template) - "Mi balance" e Ingresos/Gastos NO
   comparten alto (se probo compartirlo y no gustó: infla las cards de
   Ingresos/Gastos mas de lo necesario) - cada card mide lo que necesita su
   propio contenido, sin forzar coincidencias entre columnas. */
@media (min-width: 1024px) {
  .dashboard {
    max-width: 72rem;
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    column-gap: 1.5rem;
    align-items: start;
  }

  .dashboard-col {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .dashboard-col-primary {
    grid-column: 1;
  }

  .dashboard-col-secondary {
    grid-column: 2;
  }

  .dashboard-section {
    margin-top: 0;
  }

  /* ".dashboard-section:first-child" (mas arriba, sin media query) tiene
     mas especificidad (una clase + un pseudo-clase) que el reset de arriba
     (solo una clase) - sin este, BalanceCard (primer hijo real de la
     pantalla) seguia con margin-top:1rem en escritorio mientras el resto
     ya estaba en 0, un desalineado real de 16px en la fila de arriba. */
  .dashboard-section:first-child {
    margin-top: 0;
  }

  .dashboard-col-secondary > .dashboard-section:first-child {
    margin-top: 0;
  }

  /* Accesos rapidos con mas presencia: card de cristal propia (antes 4
     iconos flotando sobre fondo vacio) - los circulos de icono se quedan en
     su tamaño nativo ("lg" = 3.25rem, IconBadge.vue): se probo agrandarlos
     a 4rem y se veian demasiado grandes: la card ya suma presencia por si
     sola (fondo+borde+padding), no hace falta agrandar tambien el icono. */
  .quick-actions {
    padding: 1.75rem 2rem;
    border-radius: var(--radius-lg);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    backdrop-filter: blur(var(--blur-sm));
    -webkit-backdrop-filter: blur(var(--blur-sm));
  }

  /* Mismo mecanismo :deep() para agrandar el monto de Ingresos/Gastos - no
     son la raiz de IncomeExpenseSummary.vue (su raiz es
     ".income-expense-summary"; ".summary-card"/".summary-amount" son
     descendientes). */
  .income-expense-summary :deep(.summary-card) {
    padding: 1.5rem;
  }

  .income-expense-summary :deep(.summary-amount) {
    font-size: 1.75rem;
  }

  .recent-title {
    font-size: 1.375rem;
  }
}

.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.recent-title {
  font-size: 1.125rem;
}

.recent-view-all {
  flex-shrink: 0;
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.recent-view-all:hover {
  opacity: 0.85;
}

.recent-empty {
  text-align: center;
  color: var(--text-muted);
}

.recent-empty-text {
  font-size: 0.8125rem;
}
</style>
