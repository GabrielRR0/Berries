<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletsStore } from '../../stores/wallets.store'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import CreateWalletForm from './CreateWalletForm.vue'
import TransferForm from './TransferForm.vue'
import WalletCard from './WalletCard.vue'

// Pantalla "Cuentas" (/cuentas) - mismo estilo que Movimientos, pedido
// explicito del usuario ("el estilo que se hizo en movimientos debe ser lo
// mismo para la seccion cuentas"): header con volver+titulo+ayuda
// (SectionHeader.vue, generalizado a partir del de Movimientos), y
// crear/transferir abren como bottom sheet en vez de alternar un form
// inline como antes.
const router = useRouter()
const walletsStore = useWalletsStore()

const showCreateSheet = ref(false)
const showTransferSheet = ref(false)
const showHelpSheet = ref(false)

const canTransfer = computed(() => walletsStore.wallets.length >= 2)

onMounted(() => {
  walletsStore.fetchWallets().catch(() => {
    // Error ya reflejado en walletsStore.error, se muestra en el template.
  })
})

function goBack() {
  router.push({ name: 'dashboard' })
}

function onWalletCreated() {
  showCreateSheet.value = false
}

function onTransferred() {
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
    <SectionHeader title="Cuentas" max-width="64rem" @back="goBack" @help="showHelpSheet = true" />

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
      </div>

      <p v-if="walletsStore.error" class="wallets-error" role="alert">{{ walletsStore.error }}</p>

      <p v-if="walletsStore.isLoading && walletsStore.wallets.length === 0" class="wallets-loading">
        Cargando billeteras...
      </p>

      <BaseCard v-else-if="walletsStore.wallets.length === 0" class="wallets-empty">
        <p class="wallets-empty-title">Todavía no tienes billeteras</p>
        <p class="wallets-empty-text">
          Crea tu primera billetera para empezar a llevar tus cuentas en distintas monedas.
        </p>
      </BaseCard>

      <TransitionGroup
        v-else
        tag="div"
        name="wallet-item"
        class="wallets-list"
        appear
        appear-active-class="wallet-item-appear-active"
      >
        <WalletCard v-for="wallet in walletsStore.wallets" :key="wallet.id" :wallet="wallet" @delete="onDeleteWallet" />
      </TransitionGroup>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Cuentas?" @close="showHelpSheet = false">
      <p class="help-text">
        Aquí ves todas tus billeteras y cuánto tienes en cada una, en su propia moneda. Puedes crear una nueva,
        transferir dinero entre dos que ya tengas, o eliminar una que ya no uses.
      </p>
    </BottomSheet>

    <BottomSheet v-if="showCreateSheet" title="Agregar billetera" @close="showCreateSheet = false">
      <CreateWalletForm @created="onWalletCreated" @cancel="showCreateSheet = false" />
    </BottomSheet>

    <BottomSheet v-if="showTransferSheet" title="Transferir" @close="showTransferSheet = false">
      <TransferForm @transferred="onTransferred" @cancel="showTransferSheet = false" />
    </BottomSheet>
  </PageShell>
</template>

<style scoped>
.wallets-main {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
}

.capture-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.new-wallet-trigger {
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

.new-wallet-trigger:hover {
  opacity: 0.85;
}

.new-wallet-trigger:active {
  transform: scale(0.98);
  opacity: 0.75;
}

.transfer-trigger {
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

.transfer-trigger svg {
  width: 1.125rem;
  height: 1.125rem;
}

.transfer-trigger:hover {
  opacity: 0.85;
}

.transfer-trigger:active {
  transform: scale(0.94);
}

.wallets-error {
  margin-top: 1.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.wallets-loading {
  margin-top: 1.5rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.wallets-empty {
  margin-top: 1.5rem;
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

.wallets-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.help-text {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-muted);
}

/* Animacion de alta/baja de la lista - mismo criterio que TransactionList.vue
   (TransitionGroup, no un v-for plano): pedido explicito del usuario de
   "cuidar" los estilos/animaciones, consistencia con Movimientos. */
.wallet-item-move,
.wallet-item-enter-active,
.wallet-item-leave-active {
  transition:
    transform var(--duration-base) var(--ease-out),
    opacity var(--duration-base) var(--ease-out);
}

.wallet-item-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.97);
}

.wallet-item-leave-to {
  opacity: 0;
  transform: translateX(28px) scale(0.94);
}

.wallet-item-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .wallet-item-move,
  .wallet-item-enter-active,
  .wallet-item-leave-active {
    transition: opacity var(--duration-fast) linear;
  }

  .wallet-item-enter-from,
  .wallet-item-leave-to {
    transform: none;
  }
}

/* WalletCard es de altura uniforme (icono+nombre/moneda+balance, footer de
   confirmacion de borrado con altura fija), asi que un grid simple alcanza -
   sin riesgo de masonry despareja. La animacion de salida
   (.wallet-item-leave-active de arriba) va a ocupar el ancho completo del
   grid durante esos ~300ms en vez de solo su propia columna - se acepta,
   se ajusta despues solo si se ve mal en vivo. */
@media (min-width: 1024px) {
  .wallets-main {
    max-width: 64rem;
  }

  .wallets-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: 1rem;
  }
}

/* "appear" (no :nth-child sobre .wallet-item) - dispara solo en el mount
   inicial real, sin reanimarse cada vez que se crea/borra una wallet en vivo
   (lo que competiria con .wallet-item-enter-active de arriba). Fill-mode
   "backwards", ver @keyframes content-enter en style.css. */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .wallet-item-appear-active {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .wallets-list > .wallet-item-appear-active:nth-child(2) {
    animation-delay: 50ms;
  }

  .wallets-list > .wallet-item-appear-active:nth-child(3) {
    animation-delay: 100ms;
  }

  .wallets-list > .wallet-item-appear-active:nth-child(4) {
    animation-delay: 150ms;
  }

  .wallets-list > .wallet-item-appear-active:nth-child(n + 5) {
    animation-delay: 200ms;
  }
}
</style>
