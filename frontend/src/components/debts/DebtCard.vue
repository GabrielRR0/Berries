<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Debt } from '../../services/debts/interfaces/debts.interface'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import BaseCard from '../ui/BaseCard.vue'
import InstallmentSchedule from './InstallmentSchedule.vue'

// Tarjeta de una deuda individual (usada por DebtsMain.vue): contraparte,
// direccion, monto total y - si tiene cuotas - el detalle via
// InstallmentSchedule.vue. Deudas de pago unico (installments vacio, ver
// contrato de POST /api/debts) muestran una nota en vez del listado.
//
// El borrado ahora pide confirmacion en dos pasos (antes el "×" del header
// borraba de una) - pedido explicito del usuario ("los estilos y
// animaciones deben cuidarse en deudas"): mismo patron de footer con alto
// fijo + pulso rojo que WalletCard.vue/TransactionList.vue, ya que borrar
// una deuda entera es al menos tan irreversible como esos casos.
const props = defineProps<{ debt: Debt }>()

const emit = defineEmits<{ pay: [installmentId: string]; unpay: [installmentId: string]; remove: [] }>()

// "Tu debes" es el pasivo del usuario - usa el rojo de marca (mismo criterio
// que gastos en IncomeExpenseSummary.vue). "Te deben" es texto neutro, sin
// un segundo tono para "positivo" (ver style.css).
const isOwedByUser = computed(() => props.debt.direction === 'owed_by_user')
const directionLabel = computed(() => (isOwedByUser.value ? 'Tú debes' : 'Te deben'))

const confirmingDelete = ref(false)

function requestDelete() {
  confirmingDelete.value = true
}

function cancelDelete() {
  confirmingDelete.value = false
}

function confirmDelete() {
  confirmingDelete.value = false
  emit('remove')
}
</script>

<template>
  <BaseCard class="debt-card" :class="{ 'is-confirming-delete': confirmingDelete }">
    <div class="debt-header">
      <div class="debt-identity">
        <p class="debt-counterparty">{{ debt.counterpartyName }}</p>
        <p class="debt-direction" :class="{ owed: isOwedByUser }">{{ directionLabel }}</p>
      </div>

      <p class="debt-amount" :class="{ owed: isOwedByUser }">
        <AnimatedCurrency
          :value="debt.totalAmount"
          :currency="debt.currency"
          :direction="isOwedByUser ? 'down' : 'up'"
        />
      </p>
    </div>

    <p v-if="debt.description" class="debt-description">{{ debt.description }}</p>

    <InstallmentSchedule
      v-if="debt.installments.length"
      :installments="debt.installments"
      :currency="debt.currency"
      @pay="emit('pay', $event)"
      @unpay="emit('unpay', $event)"
    />
    <p v-else class="debt-lump-sum">Pago único, sin cuotas.</p>

    <!-- Mismo patron que WalletCard.vue: alto fijo, ambos estados
         position:absolute SIEMPRE, para que confirmar el borrado nunca
         mueva nada fuera de la card. -->
    <div class="debt-footer">
      <Transition name="confirm-reveal">
        <div v-if="confirmingDelete" class="debt-confirm" role="alert">
          <span class="debt-confirm-text">¿Eliminar deuda?</span>
          <div class="debt-confirm-actions">
            <button type="button" class="debt-confirm-cancel" @click="cancelDelete">Cancelar</button>
            <button type="button" class="debt-confirm-delete" @click="confirmDelete">Confirmar</button>
          </div>
        </div>
        <div v-else class="debt-actions">
          <button type="button" class="debt-delete-trigger" @click="requestDelete">Eliminar</button>
        </div>
      </Transition>
    </div>
  </BaseCard>
</template>

<style scoped>
.debt-card {
  display: flex;
  flex-direction: column;
  /* Ver comentario equivalente en WalletCard.vue: el shorthand "transition"
     no se combina entre reglas de igual especificidad, hay que repetir la
     lista completa aca para que el hover de BaseCard.vue funcione sin
     importar el orden final del CSS compilado. */
  transition:
    border-color var(--duration-base) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.debt-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.debt-counterparty {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
}

.debt-direction {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.debt-direction.owed {
  color: var(--accent);
}

.debt-amount {
  flex-shrink: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-h);
}

.debt-amount.owed {
  color: var(--accent);
}

.debt-description {
  margin-top: 0.625rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.debt-lump-sum {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Pulso rojo de una sola vez al pedir confirmacion - mismo criterio que
   WalletCard.vue/TransactionList.vue. */
.debt-card.is-confirming-delete {
  border-color: var(--accent-border);
  animation: debt-danger-pulse 700ms var(--ease-out);
}

@keyframes debt-danger-pulse {
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
  .debt-card.is-confirming-delete {
    animation: none;
  }
}

.debt-footer {
  position: relative;
  height: 2rem;
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
  overflow: hidden;
}

.debt-actions,
.debt-confirm {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
}

.debt-actions {
  justify-content: flex-end;
}

.debt-delete-trigger {
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

.debt-delete-trigger:hover {
  color: var(--accent);
}

.debt-delete-trigger:active {
  transform: scale(0.94);
}

.debt-confirm {
  justify-content: space-between;
  gap: 0.75rem;
}

.debt-confirm-text {
  font-size: 0.8125rem;
  color: var(--text);
  white-space: nowrap;
}

.debt-confirm-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.debt-confirm-cancel,
.debt-confirm-delete {
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

.debt-confirm-cancel {
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
}

.debt-confirm-delete {
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
}

.debt-confirm-cancel:hover,
.debt-confirm-delete:hover {
  opacity: 0.9;
}

.debt-confirm-cancel:active,
.debt-confirm-delete:active {
  transform: scale(0.94);
}

/* Reveal minimalista (fade + 6px) - mismo criterio que WalletCard.vue/
   TransactionList.vue. */
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
