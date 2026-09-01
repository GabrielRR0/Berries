<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWalletsStore } from '../../stores/wallets.store'
import type { DebtDirection, DebtPayment } from '../../services/debts/interfaces/debts.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { formatDate } from '../../utils/formatters/formatDate'
import IconBadge from '../ui/IconBadge.vue'

// Historial de abonos/cobros de una deuda - vive dentro de un BottomSheet propio
// (ver DebtCard.vue, que solo muestra un resumen compacto "N pagos registrados"
// como trigger) en vez de listarse directo en la card: pedido explicito del
// usuario, mostrar todos los pagos ahi se veria poco profesional apenas hubiera
// varios. Cada fila es una card de cristal (mismo lenguaje visual que
// TransactionList.vue: IconBadge + info + monto) en vez del texto plano de antes -
// pedido explicito del usuario, "mejorar los items para que se vea mas moderno e
// intuitivo". "direction" de la deuda decide el icono/color (owed_to_user = entra
// plata = income; owed_by_user = sale plata = expense), mismo criterio que usa el
// backend para categorizar la Transaction real (ver debt_payment_service.py).
//
// El borrado pide confirmacion en dos pasos - pedido explicito del usuario - mismo
// patron exacto de alto fijo que TransactionList.vue/DebtCard.vue (el bloque de
// confirmar es position:absolute dentro de un footer de alto reservado, para que
// nunca empuje el resto de la lista/el sheet que la contiene).
const props = withDefaults(
  defineProps<{ payments: DebtPayment[]; debtCurrency?: string; direction?: DebtDirection }>(),
  { debtCurrency: 'USD', direction: 'owed_to_user' },
)

const emit = defineEmits<{ remove: [paymentId: string] }>()

const walletsStore = useWalletsStore()
const confirmingId = ref<string | null>(null)

function walletName(walletId: string | null): string | null {
  if (!walletId) return null
  return walletsStore.wallets.find((wallet) => wallet.id === walletId)?.name ?? null
}

const rows = computed(() =>
  props.payments.map((payment) => ({
    ...payment,
    walletName: walletName(payment.walletId),
    showsAppliedAmount: payment.currency !== props.debtCurrency,
  })),
)

const isIncome = computed(() => props.direction === 'owed_to_user')

function requestRemove(paymentId: string) {
  confirmingId.value = paymentId
}

function cancelRemove() {
  confirmingId.value = null
}

function confirmRemove(paymentId: string) {
  confirmingId.value = null
  emit('remove', paymentId)
}
</script>

<template>
  <ul class="payment-history">
    <li v-for="payment in rows" :key="payment.id" class="payment-item">
      <div class="payment-main">
        <IconBadge :variant="isIncome ? 'income' : 'expense'">
          <svg v-if="isIncome" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M6 13l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </IconBadge>

        <div class="payment-info">
          <p class="payment-line">
            <span class="payment-amount">{{ formatCurrency(payment.amount, payment.currency) }}</span>
            <span v-if="payment.showsAppliedAmount" class="payment-applied">
              → {{ formatCurrency(payment.appliedAmount, debtCurrency) }}
            </span>
          </p>
          <p class="payment-meta">
            <span>{{ formatDate(payment.paidAt) }}</span>
            <span v-if="payment.walletName">· {{ payment.walletName }}</span>
            <span v-if="payment.note">· {{ payment.note }}</span>
          </p>
        </div>
      </div>

      <div class="payment-footer">
        <Transition name="confirm-reveal">
          <div v-if="confirmingId === payment.id" class="payment-confirm" role="alert">
            <span class="payment-confirm-text">¿Eliminar pago?</span>
            <div class="payment-confirm-actions">
              <button type="button" class="payment-confirm-cancel" @click="cancelRemove">Cancelar</button>
              <button type="button" class="payment-confirm-delete" @click="confirmRemove(payment.id)">
                Confirmar
              </button>
            </div>
          </div>
          <div v-else class="payment-actions">
            <button type="button" class="payment-remove-trigger" @click="requestRemove(payment.id)">
              Eliminar
            </button>
          </div>
        </Transition>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.payment-history {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding-left: 0;
}

.payment-item {
  padding: 0.875rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  transition: border-color var(--duration-base) var(--ease-out);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .payment-item {
    background: var(--bg-surface);
  }
}

.payment-item.is-confirming-delete {
  border-color: var(--accent-border);
}

.payment-main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.payment-info {
  min-width: 0;
  flex: 1;
}

.payment-line {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-h);
}

.payment-applied {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.payment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0.125rem 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Alto fijo, ambos estados position:absolute - mismo patron que
   TransactionList.vue/DebtCard.vue: confirmar el borrado nunca empuja el
   resto de la lista ni el sheet que la contiene. */
.payment-footer {
  position: relative;
  height: 1.75rem;
  margin-top: 0.625rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
  overflow: hidden;
}

.payment-actions,
.payment-confirm {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
}

.payment-actions {
  justify-content: flex-end;
}

.payment-remove-trigger {
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

.payment-remove-trigger:hover {
  color: var(--accent);
}

.payment-remove-trigger:active {
  transform: scale(0.94);
}

.payment-confirm {
  justify-content: space-between;
  gap: 0.75rem;
}

.payment-confirm-text {
  font-size: 0.8125rem;
  color: var(--text);
  white-space: nowrap;
}

.payment-confirm-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.payment-confirm-cancel,
.payment-confirm-delete {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.payment-confirm-cancel {
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
}

.payment-confirm-delete {
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
}

.payment-confirm-cancel:hover,
.payment-confirm-delete:hover {
  opacity: 0.9;
}

.payment-confirm-cancel:active,
.payment-confirm-delete:active {
  transform: scale(0.94);
}

/* Reveal minimalista (fade + 6px) - mismo criterio que TransactionList.vue/
   DebtCard.vue. */
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
