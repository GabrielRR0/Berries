<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useOnQuickAction } from '../../composables/navigation/useQuickActions'
import { useWalletsOverview } from '../../composables/wallets/useWalletsOverview'
import { useTransactionsStore } from '../../stores/transactions.store'
import { useWalletsStore } from '../../stores/wallets.store'
import { STATS_PERIOD_OPTIONS } from '../../utils/wallets/transferStats'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import PillToggle from '../ui/PillToggle.vue'
import StatTiles from '../ui/StatTiles.vue'
import CreateWalletForm from './CreateWalletForm.vue'
import CaptureEntryButton from '../screenshotScan/CaptureEntryButton.vue'
import RouteFeesCard from './RouteFeesCard.vue'
import TransferForm from './TransferForm.vue'
import WalletCard from './WalletCard.vue'
import WalletsHero from './WalletsHero.vue'

// Pantalla "Cuentas" (/cuentas) - mismo estilo que Movimientos (SectionHeader, crear/transferir
// en bottom sheet) y ahora con estadisticas: patrimonio total repartido por billetera, cuantas
// transferencias se hicieron, cuanto se paga en comisiones y por que ruta. Tocar una
// billetera abre su cartola. La logica vive en useWalletsOverview.ts; los estilos en
// walletsMain.css. Movil: una columna; tablet: mas ancha; escritorio: billeteras a la
// izquierda y comisiones por ruta en un panel lateral.
const router = useRouter()
const walletsStore = useWalletsStore()
const transactionsStore = useTransactionsStore()
const { wallets, period, total, shares, stats, tiles, movementCountByWallet } = useWalletsOverview()

const showCreateSheet = ref(false)
const showTransferSheet = ref(false)
const showHelpSheet = ref(false)

const canTransfer = computed(() => walletsStore.wallets.length >= 2)

// "Transferir" de los accesos rapidos de Inicio (ver useQuickActions.ts):
// abre el sheet de transferencia, o el de crear billetera si todavia no hay
// dos cuentas entre las que mover plata.
useOnQuickAction({
  transferir: () => {
    if (canTransfer.value) showTransferSheet.value = true
    else showCreateSheet.value = true
  },
})

onMounted(() => {
  walletsStore.fetchWallets().catch(() => {
    // Error ya reflejado en walletsStore.error, se muestra en el template.
  })
  // Las estadisticas salen de los movimientos (cache compartida con Movimientos).
  transactionsStore.fetchTransactions().catch(() => {
    // Sin movimientos las tarjetas quedan en cero; el error se ve en Movimientos.
  })
})

function goBack() {
  router.push({ name: 'dashboard' })
}

function onOpenWallet(walletId: string) {
  router.push({ name: 'cuenta-cartola', params: { id: walletId } })
}

function onWalletCreated() {
  showCreateSheet.value = false
}

function onTransferred() {
  showTransferSheet.value = false
}

// Sin conexion (o falla de red real) - TransferForm.vue ya encolo la
// transferencia y avisa con un toast (ver offlineQueue.store.ts); aca solo
// hace falta cerrar el sheet, igual que si hubiera transferido de una.
function onTransferQueued() {
  showTransferSheet.value = false
}

async function onDeleteWallet(walletId: string) {
  await walletsStore.removeWallet(walletId).catch(() => {
    // Error ya reflejado en walletsStore.error, se muestra en el template.
  })
}
</script>

<template>
  <PageShell>
    <SectionHeader title="Cuentas" max-width="72rem" @back="goBack" @help="showHelpSheet = true" />

    <div class="wallets-main">
      <div class="capture-row">
        <button type="button" class="new-wallet-trigger" @click="showCreateSheet = true">+ Nueva billetera</button>
        <button
          v-if="canTransfer"
          type="button"
          class="transfer-trigger"
          aria-label="Transferir entre billeteras"
          @click="showTransferSheet = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7h13M17 7l-3-3M17 7l-3 3" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M20 17H7M7 17l3 3M7 17l3-3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <CaptureEntryButton />
      </div>

      <p v-if="walletsStore.error" class="wallets-error" role="alert">{{ walletsStore.error }}</p>

      <WalletsHero class="wallets-hero-block" :wallets="wallets" :total="total" :shares="shares" />

      <section class="wallets-stats" aria-label="Resumen de transferencias y comisiones">
        <div class="wallets-stats-head">
          <h2 class="wallets-section-title">Resumen</h2>
          <PillToggle v-model="period" :options="STATS_PERIOD_OPTIONS" />
        </div>
        <StatTiles :tiles="tiles" />
      </section>

      <div class="wallets-layout">
        <section class="wallets-primary" aria-label="Tus billeteras">
          <h2 class="wallets-section-title">Tus billeteras</h2>

          <Transition name="loading-fade" mode="out-in">
            <LoadingIndicator
              v-if="walletsStore.isLoading && walletsStore.wallets.length === 0"
              key="loading"
              class="wallets-loading"
              label="Cargando billeteras..."
            />

            <BaseCard v-else-if="walletsStore.wallets.length === 0" key="empty" class="wallets-empty">
              <p class="wallets-empty-title">Todavía no tienes billeteras</p>
              <p class="wallets-empty-text">
                Crea tu primera billetera para empezar a llevar tus cuentas en distintas monedas.
              </p>
            </BaseCard>

            <TransitionGroup
              v-else
              key="list"
              tag="div"
              name="wallet-item"
              class="wallets-list"
              appear
              appear-active-class="wallet-item-appear-active"
            >
              <WalletCard
                v-for="wallet in walletsStore.wallets"
                :key="wallet.id"
                :wallet="wallet"
                :share="shares[wallet.id] ?? 0"
                :movement-count="movementCountByWallet.get(wallet.id) ?? 0"
                @open="onOpenWallet"
                @delete="onDeleteWallet"
              />
            </TransitionGroup>
          </Transition>
        </section>

        <aside class="wallets-aside">
          <RouteFeesCard :routes="stats.routes" :period="period" />
        </aside>
      </div>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Cuentas?" @close="showHelpSheet = false">
      <p class="help-text">
        Aquí ves todas tus billeteras y cuánto tienes en cada una, en su propia moneda, y el total de todas juntas en
        USD. El resumen te cuenta cuántas transferencias hiciste y cuánto pagaste en comisiones, y la lista de rutas
        te dice por cuál transferencia pagas más. Toca una billetera para ver su cartola: todos sus movimientos con el
        saldo que quedó después de cada uno.
      </p>
    </BottomSheet>

    <BottomSheet v-if="showCreateSheet" title="Agregar billetera" @close="showCreateSheet = false">
      <CreateWalletForm @created="onWalletCreated" @cancel="showCreateSheet = false" />
    </BottomSheet>

    <BottomSheet v-if="showTransferSheet" title="Transferir" @close="showTransferSheet = false">
      <TransferForm @transferred="onTransferred" @queued="onTransferQueued" @cancel="showTransferSheet = false" />
    </BottomSheet>
  </PageShell>
</template>

<style scoped src="./walletsMain.css"></style>
