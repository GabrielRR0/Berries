<script setup lang="ts">
import { ref } from 'vue'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import BaseCard from '../ui/BaseCard.vue'
import IconBadge from '../ui/IconBadge.vue'

// Tarjeta tonta de una wallet: nombre/moneda/balance + un delete de dos
// pasos inline (en vez de window.confirm nativo, para que se vea/sienta
// parte de la UI de Berry en lugar de un dialogo del navegador). Quien la
// usa (WalletsMain.vue) decide que hacer con el emit 'delete'.
const props = defineProps<{ wallet: Wallet }>()
const emit = defineEmits<{ delete: [walletId: string] }>()

const confirmingDelete = ref(false)

function requestDelete() {
  confirmingDelete.value = true
}

function cancelDelete() {
  confirmingDelete.value = false
}

function confirmDelete() {
  confirmingDelete.value = false
  emit('delete', props.wallet.id)
}
</script>

<template>
  <BaseCard class="wallet-card" :class="{ 'is-confirming-delete': confirmingDelete }">
    <div class="wallet-main">
      <IconBadge>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18" stroke-linecap="round" />
          <path d="M16 15h2" stroke-linecap="round" />
        </svg>
      </IconBadge>

      <div class="wallet-info">
        <p class="wallet-name">{{ wallet.name }}</p>
        <p class="wallet-currency">{{ wallet.currency }}</p>
      </div>

      <p class="wallet-balance">
        <AnimatedCurrency :value="wallet.balance" :currency="wallet.currency" />
      </p>
    </div>

    <!-- Alto fijo + ambos estados position:absolute - mismo criterio que
         TransactionList.vue, para que confirmar el borrado nunca mueva nada
         fuera de la card (pedido explicito del usuario en esa pantalla,
         extendido aca por consistencia). -->
    <div class="wallet-footer">
      <Transition name="confirm-reveal">
        <div v-if="confirmingDelete" class="wallet-confirm" role="alert">
          <span class="wallet-confirm-text">¿Eliminar?</span>
          <div class="wallet-confirm-actions">
            <button type="button" class="wallet-confirm-cancel" @click="cancelDelete">Cancelar</button>
            <button type="button" class="wallet-confirm-delete" @click="confirmDelete">Confirmar</button>
          </div>
        </div>
        <div v-else class="wallet-actions">
          <button type="button" class="wallet-delete-trigger" @click="requestDelete">Eliminar</button>
        </div>
      </Transition>
    </div>
  </BaseCard>
</template>

<style scoped>
.wallet-card {
  display: flex;
  flex-direction: column;
  /* border-color/transform/box-shadow completos aca (no solo border-color) -
     BaseCard.vue ya declara su propio hover con estas 3 propiedades, pero el
     shorthand "transition" no se combina entre reglas de igual
     especificidad: gana la ultima en el CSS compilado, no importa si es la
     del padre o la del hijo. Repitiendo la lista completa aca, el hover
     funciona sin importar el orden final del bundle. */
  transition:
    border-color var(--duration-base) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.wallet-main {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.wallet-info {
  flex: 1;
  min-width: 0;
}

.wallet-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
}

.wallet-currency {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.wallet-balance {
  flex-shrink: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-h);
}

/* Pulso rojo de una sola vez al pedir confirmacion - mismo criterio que
   .transaction-item.is-confirming-delete en TransactionList.vue. */
.wallet-card.is-confirming-delete {
  border-color: var(--accent-border);
  animation: wallet-danger-pulse 700ms var(--ease-out);
}

@keyframes wallet-danger-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45);
  }
  60% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wallet-card.is-confirming-delete {
    animation: none;
  }
}

/* Alto FIJO (no min-height) y ambos estados position:absolute SIEMPRE (no
   solo durante la transicion) - mismo bug real ya encontrado y arreglado en
   TransactionList.vue: sin esto, la diferencia de padding entre el trigger
   "Eliminar" y los botones de confirmar se filtra al alto final segun cual
   este montado, y la card "salta" un par de pixeles. */
.wallet-footer {
  position: relative;
  height: 2rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
  overflow: hidden;
}

.wallet-actions,
.wallet-confirm {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
}

.wallet-actions {
  justify-content: flex-end;
}

.wallet-delete-trigger {
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.wallet-delete-trigger:hover {
  color: var(--accent);
}

.wallet-delete-trigger:active {
  transform: scale(0.94);
}

.wallet-confirm {
  justify-content: space-between;
  gap: 0.75rem;
}

.wallet-confirm-text {
  font-size: 0.8125rem;
  color: var(--text);
}

.wallet-confirm-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.wallet-confirm-cancel,
.wallet-confirm-delete {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.wallet-confirm-cancel {
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
}

.wallet-confirm-delete {
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
}

.wallet-confirm-cancel:hover,
.wallet-confirm-delete:hover {
  opacity: 0.9;
}

.wallet-confirm-cancel:active,
.wallet-confirm-delete:active {
  transform: scale(0.94);
}

/* Reveal minimalista (fade + 6px), contenido DENTRO de .wallet-footer (alto
   fijo, overflow:hidden) - mismo criterio que TransactionList.vue: el pulso
   rojo de arriba es la señal "llamativa", esto se queda deliberadamente
   discreto. */
.confirm-reveal-enter-active,
.confirm-reveal-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.confirm-reveal-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.confirm-reveal-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .confirm-reveal-enter-active,
  .confirm-reveal-leave-active {
    transition: opacity var(--duration-fast) linear;
  }

  .confirm-reveal-enter-from,
  .confirm-reveal-leave-to {
    transform: none;
  }
}
</style>
