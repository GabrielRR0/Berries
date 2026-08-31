<script setup lang="ts">
import { onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOnboardingTour } from '../../composables/onboarding/useOnboardingTour'
import { useWalletsStore } from '../../stores/wallets.store'
import PageShell from '../layout/PageShell.vue'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import BaseCard from '../ui/BaseCard.vue'
import BalanceCard from './BalanceCard.vue'
import IncomeExpenseSummary from './IncomeExpenseSummary.vue'
import QuickActionsGrid from './QuickActionsGrid.vue'

// Pantalla "Inicio" - la carga real de wallets ocurre dentro de
// BalanceCard.vue (que se monta como hijo de esta misma pantalla), asi que
// la seccion "Mis balances" de aca abajo solo LEE el wallets.store
// compartido (Pinia es singleton) en vez de volver a pedir la lista.
// TopHeader/BottomTabBar ya no se montan aca - viven una sola vez en
// App.vue, ver el comentario de PageShell.vue.
const walletsStore = useWalletsStore()
const router = useRouter()
const { close: closeTour } = useOnboardingTour()

function onAddWalletClick() {
  router.push({ name: 'cuentas' })
}

// Si el usuario navega a otra pestaña con el tour a mitad de camino, esta
// pantalla se desmonta (cada ruta es una instancia nueva) - sin este cierre,
// al volver a Inicio reaparecería el mismo paso donde quedó, sin que el
// usuario haya vuelto a tocar el "?" del header.
onUnmounted(closeTour)
</script>

<template>
  <PageShell>
    <div class="dashboard">
      <!-- Wrapper divs - cada columna de escritorio es su propio stack
           independiente (ver @media min-width:1024px). En mobile/tablet
           son bloques transparentes sin estilo propio, el flujo se ve
           identico a como era antes. -->
      <div class="dashboard-col dashboard-col-primary">
        <BalanceCard class="dashboard-section" />
        <QuickActionsGrid class="dashboard-section" />
      </div>

      <div class="dashboard-col dashboard-col-secondary">
        <IncomeExpenseSummary class="dashboard-section" />

        <section class="dashboard-section wallets-section">
          <div class="wallets-header">
            <h2 class="wallets-title">Mis balances</h2>
            <!-- Manda a /cuentas (WalletsMain.vue) - ahi vive la creacion real
                 de wallets, ver componentes bajo components/wallets/. -->
            <button type="button" class="wallets-fab" aria-label="Agregar billetera" @click="onAddWalletClick">
              <!-- SVG en vez del glyph de texto "+" - un caracter de texto no
                   queda perfectamente centrado dentro de un circulo flex
                   (la metrica de la fuente no coincide con el centro visual
                   real del simbolo), un SVG con paths propios si. -->
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <BaseCard v-if="walletsStore.wallets.length === 0" class="wallets-empty">
            <p class="wallets-empty-title">Todavía no tienes billeteras</p>
            <p class="wallets-empty-text">
              Crea tu primera billetera para empezar a llevar tus cuentas en distintas monedas.
            </p>
          </BaseCard>

          <ul v-else class="wallets-preview-list">
            <li v-for="wallet in walletsStore.wallets" :key="wallet.id" class="wallets-preview-item">
              <!-- Icono - oculto por default (display:none mas abajo),
                   visible solo en escritorio: mismo icono de "Cuentas" ya
                   usado en QuickActionsGrid.vue/WalletCard.vue, sin inventar
                   uno nuevo. -->
              <span class="wallets-preview-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="6" width="18" height="13" rx="2" />
                  <path d="M3 10h18" />
                  <path d="M16 15h2" stroke-linecap="round" />
                </svg>
              </span>
              <span class="wallets-preview-name">{{ wallet.name }}</span>
              <span class="wallets-preview-balance">
                <AnimatedCurrency :value="wallet.balance" :currency="wallet.currency" />
              </span>
            </li>
          </ul>
        </section>
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

  .wallets-title {
    font-size: 1.375rem;
  }

  .wallets-preview-item {
    padding: 1.125rem 1.25rem;
  }

  .wallets-preview-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg-strong);
    color: var(--text-h);
  }

  .wallets-preview-icon svg {
    width: 46%;
    height: 46%;
  }

  .wallets-preview-name {
    flex: 1;
    min-width: 0;
  }
}

/* Animacion de entrada al cargar Inicio en escritorio - bloque SEPARADO del
   de layout de arriba (no fusionado) para poder agregarle el guard extra de
   prefers-reduced-motion sin tocar las reglas de grid. animation-fill-mode
   "backwards" (nunca "both"/"forwards"): ver @keyframes content-enter en
   style.css - "forwards" dejaria el transform pisado para siempre, y estos
   mismos elementos ya reciben su propio hover de BaseCard.vue en varios
   casos (ej. las cards de .wallets-empty). Delays escalonados siguiendo el
   orden visual de grid-template-areas (balance -> actions -> summary ->
   wallets). */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .balance-card {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .quick-actions {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 50ms;
  }

  .income-expense-summary {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 100ms;
  }

  .wallets-section {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 150ms;
  }
}

.wallets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.wallets-title {
  font-size: 1.125rem;
}

.wallets-fab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-contrast);
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.wallets-fab svg {
  width: 1.125rem;
  height: 1.125rem;
}

.wallets-fab:hover {
  opacity: 0.9;
}

.wallets-fab:active {
  transform: scale(0.88);
  opacity: 0.8;
}

.wallets-empty {
  text-align: center;
  color: var(--text-muted);
}

.wallets-empty-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
}

.wallets-empty-text {
  margin-top: 0.375rem;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.wallets-preview-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.wallets-preview-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  transition:
    border-color var(--duration-base) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

/* No usa BaseCard.vue (duplica su look de cristal a mano, igual que
   .transaction-item en TransactionList.vue), asi que no recibe el hover de
   BaseCard.vue "gratis" - mismo tratamiento aplicado explicito aca. Sin
   esto, esta era la unica lista de cards de toda la app sin respuesta al
   mouse - se sentia mas plana que el resto. */
@media (min-width: 1024px) and (hover: hover) and (pointer: fine) {
  .wallets-preview-item:hover {
    transform: translateY(-4px);
    border-color: var(--glass-border-hover);
    box-shadow: var(--shadow-lg);
  }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .wallets-preview-item {
    background: var(--bg-surface);
  }
}

.wallets-preview-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-h);
}

/* Oculto por default (mobile/tablet) - solo se muestra en escritorio (ver
   @media min-width:1024px mas arriba), mismo patron ya usado en
   TransactionsMain.vue (".filters-sidebar"). Sin este display:none de base,
   el <span><svg>...</svg></span> se renderizaria inline sin tamaño definido
   en mobile. */
.wallets-preview-icon {
  display: none;
}

.wallets-preview-balance {
  font-size: 0.9375rem;
  /* 600, no 700 - pedido explicito del usuario ("una fuente algo mas fina");
     sigue distinguiendose del nombre (tambien 600) por ser mas grande, no
     hace falta el peso extra para que se lea como el dato principal. */
  font-weight: 600;
  color: var(--text-h);
}
</style>
