<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Debt } from '../../services/debts/interfaces/debts.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
// Reutilizado de Metas (idea de la sesion de brainstorm de UI): es generico
// a proposito (no sabe nada de "tipos de meta", ver su propio comentario),
// asi que sirve igual aca para "% pagado" - antes Deudas era la unica
// seccion con progreso solo en texto ("Resta $X"), sin ningun indicador
// visual como el que ya tiene Metas.
import GoalProgressRing from '../goals/GoalProgressRing.vue'
import DebtPaymentHistory from './DebtPaymentHistory.vue'
import InstallmentSchedule from './InstallmentSchedule.vue'

// Tarjeta de una deuda individual (usada por DebtsMain.vue): contraparte,
// direccion, monto total y - si tiene cuotas - el detalle via
// InstallmentSchedule.vue. Deudas de pago unico (installments vacio, ver
// contrato de POST /api/debts) muestran una nota en vez del listado.
//
// Abonos libres (AddDebtPaymentForm.vue/DebtPaymentHistory.vue) - pedido
// explicito del usuario: registrar cualquier pago parcial en cualquier
// momento y ver el historial, ademas de (opcional) las cuotas de arriba.
//
// El borrado ahora pide confirmacion en dos pasos (antes el "×" del header
// borraba de una) - pedido explicito del usuario ("los estilos y
// animaciones deben cuidarse en deudas"): mismo patron de footer con alto
// fijo + pulso rojo que WalletCard.vue/TransactionList.vue, ya que borrar
// una deuda entera es al menos tan irreversible como esos casos.
const props = defineProps<{ debt: Debt }>()

const emit = defineEmits<{
  pay: [installmentId: string]
  unpay: [installmentId: string]
  remove: []
  openAddPayment: []
  removePayment: [paymentId: string]
}>()

// "Tu debes" es el pasivo del usuario - usa el rojo de marca (mismo criterio
// que gastos en IncomeExpenseSummary.vue). "Te deben" es texto neutro, sin
// un segundo tono para "positivo" (ver style.css).
const isOwedByUser = computed(() => props.debt.direction === 'owed_by_user')
const directionLabel = computed(() => (isOwedByUser.value ? 'Tú debes' : 'Te deben'))

const paidPercent = computed(() => {
  if (props.debt.totalAmount <= 0) return 0
  return Math.min(100, Math.round((props.debt.amountPaid / props.debt.totalAmount) * 100))
})

// El historial vive en un sheet aparte, no inline en la card - pedido explicito
// del usuario ("cuando hayan muchos pagos se veria poco profesional" mostrarlos
// todos directo en la box). La card solo muestra un resumen compacto.
const showHistorySheet = ref(false)

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

      <div class="debt-amount-col">
        <GoalProgressRing v-if="debt.amountPaid > 0" :percent="paidPercent" :size="36" class="debt-progress-ring">
          <span class="debt-progress-percent">{{ paidPercent }}%</span>
        </GoalProgressRing>

        <div class="debt-amount-stack">
          <p class="debt-amount" :class="{ owed: isOwedByUser }">
            <AnimatedCurrency
              :value="debt.totalAmount"
              :currency="debt.currency"
              :direction="isOwedByUser ? 'down' : 'up'"
            />
          </p>
          <p v-if="debt.amountPaid > 0" class="debt-remaining">
            Resta {{ formatCurrency(debt.remainingAmount, debt.currency) }}
          </p>
        </div>
      </div>
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

    <button
      v-if="debt.payments.length"
      type="button"
      class="payment-history-trigger"
      @click="showHistorySheet = true"
    >
      <span>{{ debt.payments.length }} {{ debt.payments.length === 1 ? 'pago registrado' : 'pagos registrados' }}</span>
      <span class="payment-history-arrow" aria-hidden="true">›</span>
    </button>

    <BaseButton variant="secondary" class="add-payment-trigger" @click="emit('openAddPayment')">
      Registrar pago
    </BaseButton>

    <!-- <Teleport to="body">: BaseCard tiene hover con transform (ver
         BaseCard.vue) - un ancestro con transform activo redefine el
         "containing block" de cualquier position:fixed adentro (el
         .sheet-scrim de BottomSheet.vue), asi que sin esto la modal terminaba
         posicionada/recortada relativa a la card en vez de a toda la pantalla
         apenas el mouse quedaba encima (bug real, reportado en vivo). Mismo
         patron ya usado en GoalCard.vue para su dropdown. -->
    <Teleport to="body">
      <BottomSheet
        v-if="showHistorySheet"
        class="payment-history-sheet"
        title="Historial de pagos"
        @close="showHistorySheet = false"
      >
        <DebtPaymentHistory
          :payments="debt.payments"
          :debt-currency="debt.currency"
          :direction="debt.direction"
          @remove="emit('removePayment', $event)"
        />
      </BottomSheet>
    </Teleport>

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

.debt-amount-col {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.debt-progress-ring {
  color: var(--text-h);
}

.debt-progress-percent {
  font-size: 0.625rem;
  font-weight: 700;
}

.debt-amount-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
}

.debt-amount {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-h);
}

.debt-amount.owed {
  color: var(--accent);
}

.debt-remaining {
  font-size: 0.75rem;
  color: var(--text-muted);
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

.payment-history-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border: none;
  border-top: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out);
}

.payment-history-trigger:hover {
  color: var(--text-h);
}

.payment-history-arrow {
  font-size: 1.125rem;
  line-height: 1;
}

.add-payment-trigger {
  margin-top: 0.75rem;
  width: 100%;
}

/* La clase pasada a <BottomSheet> cae en su raiz (.sheet-scrim, ver
   BottomSheet.vue), no en .sheet-panel - de ahi el :deep() acá. Alto minimo
   pedido explicito del usuario: con pocos pagos el sheet no debe verse como
   una tira angosta - min-height le gana a max-height cuando compiten (ver
   BottomSheet.vue), asi que en viewports muy bajos (celular en horizontal)
   puede sobrepasar el 80vh de la regla general - trade-off aceptado. */
.payment-history-sheet :deep(.sheet-panel) {
  min-height: 24rem;
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
