<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Transaction } from '../../services/transactions/interfaces/transactions.interface'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { formatDate } from '../../utils/formatters/formatDate'
import IconBadge from '../ui/IconBadge.vue'

// Lista pura de movimientos ya cargados (TransactionsMain.vue hace el
// fetch). Cada fila indica el tipo con icono+color segun la regla de
// paleta de Berry (IconBadge variant="expense" ya usa el rojo de acento,
// variant="income" se queda neutro - ver IconBadge.vue/style.css) y ademas
// tiene un delete de dos pasos igual al de WalletCard.vue (sin
// window.confirm nativo). El monto se muestra en la moneda de LA WALLET del
// movimiento (no en la de currencyStore) - una transaction no trae su propia
// moneda, solo wallet_id, asi que se resuelve buscando la wallet en la lista
// dada por props (fallbackCurrency cubre el caso de una wallet ya borrada).
const props = withDefaults(defineProps<{ transactions: Transaction[]; wallets: Wallet[]; fallbackCurrency?: string }>(), {
  fallbackCurrency: 'USD',
})
// "edit": pedido explicito del usuario ("se debe poder editar los movimientos...
// montos, fecha de pago, description, wallet_id, category") - nunca para una pata de
// transferencia (ver el v-if del boton en el template: el backend las rechaza, ver
// update_transaction, editarlas de a una dejaria el ledger de la transferencia
// inconsistente).
const emit = defineEmits<{ delete: [transactionId: string]; edit: [transaction: Transaction] }>()

const confirmingDeleteId = ref<string | null>(null)

function currencyFor(transaction: Transaction): string {
  return props.wallets.find((wallet) => wallet.id === transaction.walletId)?.currency ?? props.fallbackCurrency
}

function walletName(walletId: string): string {
  return props.wallets.find((wallet) => wallet.id === walletId)?.name ?? 'billetera eliminada'
}

// Valor de referencia en USD, CONGELADO al momento de crear la transaccion (ver
// reference_amount_usd/create_transaction del backend) - pedido explicito del
// usuario: para un gasto en una moneda nacional con inflacion fuerte (VEF, COP,
// ARS...) quiere ver "cuanto era eso ese dia" de forma fija, no recalculada con la
// tasa de HOY cada vez que se abre la lista. null cuando la wallet ya esta en USD (el
// monto principal YA es la referencia, mostrar el mismo numero dos veces no aporta).
function referenceLabel(transaction: Transaction): string | null {
  if (transaction.referenceAmountUsd === null) return null
  return `≈ ${formatCurrency(transaction.referenceAmountUsd, 'USD')} al momento`
}

interface TransferListItem {
  kind: 'transfer'
  transferId: string
  occurredAt: string
  fromLeg: Transaction
  toLeg: Transaction
  feeLeg: Transaction | null
}
interface SingleListItem {
  kind: 'single'
  transaction: Transaction
}
type ListItem = TransferListItem | SingleListItem

function listItemId(item: ListItem): string {
  return item.kind === 'transfer' ? item.transferId : item.transaction.id
}

// Solo relevante para una pata de transferencia "suelta" (ver listItems mas
// abajo: cuando un filtro externo deja visible una sola pata, se muestra
// individual en vez de fusionada) - mismo tratamiento neutro que la card
// fusionada.
function isTransfer(transaction: Transaction): boolean {
  return transaction.source === 'transfer'
}

// Una transferencia entre wallets propias no es un ingreso ni un gasto real -
// plata que solo cambia de lugar (ver transfer_service.py). Pedido explicito
// del usuario: verla como DOS filas separadas ("Transferencia a X" en una
// wallet, "Transferencia desde Y" en la otra) confundia mas que ayudaba -
// ahora se fusionan en UNA sola fila "X → Y" siempre que ambas patas
// (fromLeg/toLeg, mismo transferId) esten presentes en la lista recibida. Si
// un filtro externo (ver TransactionsMain.vue) deja solo una pata visible -
// p.ej. buscar texto que matchea una sola descripcion -, esa pata se
// muestra suelta en vez de forzar una fusion a medias. La comision (si la
// hubo) es su propia transaction real (source="manual", category="Comisión")
// y SIEMPRE se fusiona a la card cuando esta presente, mostrandose como el
// monto principal (es el unico costo real de la transferencia).
const listItems = computed<ListItem[]>(() => {
  const groups = new Map<string, { fromLeg?: Transaction; toLeg?: Transaction; feeLeg?: Transaction }>()
  for (const transaction of props.transactions) {
    if (!transaction.transferId) continue
    const group = groups.get(transaction.transferId) ?? {}
    if (transaction.source === 'transfer' && transaction.type === 'expense') group.fromLeg = transaction
    else if (transaction.source === 'transfer' && transaction.type === 'income') group.toLeg = transaction
    else group.feeLeg = transaction
    groups.set(transaction.transferId, group)
  }

  const emittedGroups = new Set<string>()
  const items: ListItem[] = []
  for (const transaction of props.transactions) {
    const group = transaction.transferId ? groups.get(transaction.transferId) : undefined
    if (group?.fromLeg && group.toLeg) {
      if (emittedGroups.has(transaction.transferId!)) continue
      emittedGroups.add(transaction.transferId!)
      items.push({
        kind: 'transfer',
        transferId: transaction.transferId!,
        occurredAt: group.fromLeg.occurredAt,
        fromLeg: group.fromLeg,
        toLeg: group.toLeg,
        feeLeg: group.feeLeg ?? null,
      })
      continue
    }
    items.push({ kind: 'single', transaction })
  }
  return items
})

// Texto chico bajo el titulo de una card de transferencia fusionada: el
// monto que realmente se movio, siempre en segundo plano (pedido explicito
// del usuario de que el monto grande sea la comision, no el principal). Si
// origen/destino tienen moneda distinta se aclaran los dos montos, ya que
// no son intercambiables 1 a 1.
function transferSecondaryText(item: TransferListItem): string {
  const fromText = formatCurrency(item.fromLeg.amount, currencyFor(item.fromLeg))
  const toCurrency = currencyFor(item.toLeg)
  if (toCurrency !== currencyFor(item.fromLeg)) return `${fromText} → ${formatCurrency(item.toLeg.amount, toCurrency)}`
  return item.feeLeg ? `${fromText} transferidos` : `${fromText} transferidos, sin comisión`
}

function requestDelete(id: string) {
  confirmingDeleteId.value = id
}

function cancelDelete() {
  confirmingDeleteId.value = null
}

function confirmDelete(id: string) {
  confirmingDeleteId.value = null
  // Cualquier id del grupo alcanza: el backend borra/revierte todas las
  // patas que compartan transfer_id en un mismo commit (ver
  // transaction_service.delete_transaction).
  emit('delete', id)
}
</script>

<template>
  <TransitionGroup
    tag="ul"
    name="transaction-item"
    class="transaction-list"
    appear
    appear-active-class="transaction-item-appear-active"
  >
    <li
      v-for="item in listItems"
      :key="listItemId(item)"
      class="transaction-item"
      :class="{ 'is-confirming-delete': confirmingDeleteId === listItemId(item) }"
    >
      <div v-if="item.kind === 'transfer'" class="transaction-main">
        <IconBadge variant="neutral">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 7h11m0 0-3.5-3.5M18 7l-3.5 3.5M17 17H6m0 0 3.5-3.5M6 17l3.5 3.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </IconBadge>

        <div class="transaction-info">
          <p class="transaction-category">{{ walletName(item.fromLeg.walletId) }} → {{ walletName(item.toLeg.walletId) }}</p>
          <p class="transaction-date">{{ formatDate(item.occurredAt) }}</p>
          <p class="transaction-description">{{ transferSecondaryText(item) }}</p>
        </div>

        <p class="transaction-amount" :class="{ expense: item.feeLeg }">
          <template v-if="item.feeLeg">-{{ formatCurrency(item.feeLeg.amount, currencyFor(item.feeLeg)) }}</template>
          <template v-else>{{ formatCurrency(item.fromLeg.amount, currencyFor(item.fromLeg)) }}</template>
        </p>
      </div>

      <div v-else class="transaction-main">
        <IconBadge :variant="isTransfer(item.transaction) ? 'neutral' : item.transaction.type === 'expense' ? 'expense' : 'income'">
          <svg v-if="isTransfer(item.transaction)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 7h11m0 0-3.5-3.5M18 7l-3.5 3.5M17 17H6m0 0 3.5-3.5M6 17l3.5 3.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else-if="item.transaction.type === 'expense'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M6 13l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </IconBadge>

        <div class="transaction-info">
          <p class="transaction-category">{{ item.transaction.category }}</p>
          <p class="transaction-date">{{ formatDate(item.transaction.occurredAt) }}</p>
          <p v-if="item.transaction.description" class="transaction-description">{{ item.transaction.description }}</p>
        </div>

        <div class="transaction-amount-group">
          <p class="transaction-amount" :class="{ expense: item.transaction.type === 'expense' && !isTransfer(item.transaction) }">
            <template v-if="!isTransfer(item.transaction)">{{ item.transaction.type === 'expense' ? '-' : '+' }}</template
            >{{ formatCurrency(item.transaction.amount, currencyFor(item.transaction)) }}
          </p>
          <p v-if="referenceLabel(item.transaction)" class="transaction-reference">{{ referenceLabel(item.transaction) }}</p>
        </div>
      </div>

      <!-- Alto fijo (.transaction-footer) - pedido explicito del usuario:
           la version anterior crecia en altura al mostrar el confirm, lo
           que empujaba el resto de la lista y hacia "temblar" el bottom
           sheet que la contiene. Con un alto reservado fijo, la card NUNCA
           cambia de tamaño - solo el contenido de ADENTRO hace fade+
           micro-desplazamiento (contenido por overflow:hidden, nada se
           mueve afuera de la card). El pulso rojo de .is-confirming-delete
           (ver mas abajo) sigue siendo la señal "llamativa" de zona de
           peligro, sin depender de que el bloque crezca. -->
      <div class="transaction-footer">
        <Transition name="confirm-reveal">
          <div v-if="confirmingDeleteId === listItemId(item)" class="transaction-confirm" role="alert">
            <span class="transaction-confirm-text">
              {{ item.kind === 'transfer' || item.transaction.transferId ? '¿Eliminar transferencia?' : '¿Eliminar?' }}
            </span>
            <div class="transaction-confirm-actions">
              <button type="button" class="transaction-confirm-cancel" @click="cancelDelete">Cancelar</button>
              <button
                type="button"
                class="transaction-confirm-delete"
                @click="confirmDelete(item.kind === 'transfer' ? item.fromLeg.id : item.transaction.id)"
              >
                Confirmar
              </button>
            </div>
          </div>
          <div v-else class="transaction-actions">
            <!-- Nunca para una pata de transferencia (transferId no nulo, ni siquiera
                 la comisión con source="manual") - el backend la rechaza igual (ver
                 update_transaction), editarla de a una dejaria el ledger de la
                 transferencia inconsistente. -->
            <button
              v-if="item.kind === 'single' && item.transaction.transferId === null"
              type="button"
              class="transaction-edit-trigger"
              @click="emit('edit', item.transaction)"
            >
              Editar
            </button>
            <button type="button" class="transaction-delete-trigger" @click="requestDelete(listItemId(item))">
              Eliminar
            </button>
          </div>
        </Transition>
      </div>
    </li>
  </TransitionGroup>
</template>

<style scoped>
.transaction-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.transaction-item {
  padding: 1rem;
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

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .transaction-item {
    background: var(--bg-surface);
  }
}

/* No usa BaseCard.vue (duplica su look de cristal a mano), asi que no
   recibe el hover de BaseCard.vue "gratis" - mismo tratamiento aplicado
   explicito aca. */
@media (min-width: 1024px) and (hover: hover) and (pointer: fine) {
  .transaction-item:hover {
    transform: translateY(-4px);
    border-color: var(--glass-border-hover);
    box-shadow: var(--shadow-lg);
  }
}

/* Pedido explicito del usuario: al pedir confirmacion de borrado, algo
   "llamativo" pero SIN mover nada fuera de la card - un anillo rojo que
   pulsa una vez (no en loop, no afecta layout) deja clara la "zona de
   peligro". El contenido de abajo (ver .confirm-reveal-* mas abajo) se
   queda deliberadamente minimalista y contenido en un alto fijo. */
.transaction-item.is-confirming-delete {
  border-color: var(--accent-border);
  animation: transaction-danger-pulse 700ms var(--ease-out);
}

@keyframes transaction-danger-pulse {
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
  .transaction-item.is-confirming-delete {
    animation: none;
  }
}

.transaction-main {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.transaction-info {
  flex: 1;
  min-width: 0;
}

.transaction-category {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
  text-transform: capitalize;
}

.transaction-date {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.transaction-description {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transaction-amount-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
  flex-shrink: 0;
}

.transaction-amount {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-h);
}

/* Valor congelado en USD al momento de la transaccion (ver reference_amount_usd del
   backend) - pedido explicito del usuario: para un gasto en una moneda nacional
   (VEF, COP, ARS...) quiere ver a simple vista cuanto era eso ese dia, sin abrir el
   detalle. Solo aparece cuando la wallet no estaba ya en USD (ver referenceLabel). */
.transaction-reference {
  font-size: 0.6875rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.transaction-amount.expense {
  color: var(--accent);
}

/* Alto FIJO (no min-height) - ver comentario en el template. Los botones de
   confirmar (padding 0.375rem) son naturalmente un poco mas altos que el
   trigger "Eliminar" (padding 0.25rem) - con solo un min-height, ese par de
   pixeles de diferencia SEGUIA filtrandose al alto final de la card segun
   cual de los dos estuviera montado (confirmado midiendo con Playwright).
   Por eso ambos estados van siempre position:absolute (no solo durante la
   transicion): asi el contenido nunca participa del alto de
   .transaction-footer, sea cual sea su alto natural. */
.transaction-footer {
  position: relative;
  height: 2rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
  overflow: hidden;
}

.transaction-actions,
.transaction-confirm {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
}

.transaction-actions {
  justify-content: flex-end;
  gap: 0.75rem;
}

.transaction-edit-trigger {
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

.transaction-edit-trigger:hover {
  color: var(--text-h);
}

.transaction-edit-trigger:active {
  transform: scale(0.94);
}

.transaction-delete-trigger {
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

.transaction-delete-trigger:hover {
  color: var(--accent);
}

.transaction-delete-trigger:active {
  transform: scale(0.94);
}

.transaction-confirm {
  justify-content: space-between;
  gap: 0.75rem;
}

.transaction-confirm-text {
  font-size: 0.8125rem;
  color: var(--text);
  white-space: nowrap;
}

.transaction-confirm-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.transaction-confirm-cancel,
.transaction-confirm-delete {
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

.transaction-confirm-cancel {
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
}

.transaction-confirm-delete {
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
}

.transaction-confirm-cancel:hover,
.transaction-confirm-delete:hover {
  opacity: 0.9;
}

.transaction-confirm-cancel:active,
.transaction-confirm-delete:active {
  transform: scale(0.94);
}

/* Reveal del bloque de confirmar - CONTENIDO dentro de .transaction-footer
   (alto fijo, overflow:hidden, ambos estados ya position:absolute - ver
   arriba), pedido explicito del usuario: la primera version crecia en alto
   y "empujaba" el resto de la lista/el bottom sheet que la contiene. Ahora
   es solo fade + un desplazamiento chico (6px) - nada se mueve fuera de la
   card. El pulso rojo de .is-confirming-delete es la parte "llamativa";
   esto de aca es deliberadamente minimalista. */
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

/* Al eliminar un movimiento, la fila desliza hacia el costado y se achica
   en vez de desaparecer de golpe - pedido explicito del usuario ("cuando
   se elimina debe tener tambien una animacion"). Las filas nuevas entran
   desde abajo; las que quedan se re-acomodan con .transaction-item-move
   (TransitionGroup FLIP) en vez de saltar de golpe al lugar de la fila
   borrada. */
.transaction-item-move,
.transaction-item-enter-active,
.transaction-item-leave-active {
  transition:
    transform var(--duration-base) var(--ease-out),
    opacity var(--duration-base) var(--ease-out);
}

.transaction-item-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.97);
}

.transaction-item-leave-to {
  opacity: 0;
  transform: translateX(28px) scale(0.94);
}

/* Position:absolute durante el leave para que las filas restantes puedan
   re-acomodarse (.transaction-item-move) mientras esta todavia se ve
   deslizando afuera - sin esto la fila borrada seguiria ocupando su
   espacio en el flex hasta recien desaparecer. */
.transaction-item-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .transaction-item-move,
  .transaction-item-enter-active,
  .transaction-item-leave-active {
    transition: opacity var(--duration-fast) linear;
  }

  .transaction-item-enter-from,
  .transaction-item-leave-to {
    transform: none;
  }
}

/* Animacion de entrada al cargar la pantalla en escritorio - usa "appear"
   (dispara solo en el mount inicial real) en vez de :nth-child sobre
   .transaction-item, que se reanimaria cada vez que se agrega/borra un
   movimiento en vivo, compitiendo con .transaction-item-enter-active de
   arriba. animation-fill-mode "backwards" (nunca "both"/"forwards"): ver
   @keyframes content-enter en style.css. */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .transaction-item-appear-active {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .transaction-list > .transaction-item-appear-active:nth-child(2) {
    animation-delay: 50ms;
  }

  .transaction-list > .transaction-item-appear-active:nth-child(3) {
    animation-delay: 100ms;
  }

  .transaction-list > .transaction-item-appear-active:nth-child(4) {
    animation-delay: 150ms;
  }

  .transaction-list > .transaction-item-appear-active:nth-child(n + 5) {
    animation-delay: 200ms;
  }
}

/* Entrada escalonada al cambiar de mes (o filtro) en escritorio - pedido
   explicito del usuario ("quiero que aparezcan mas fluido las cards"): sin
   esto, cuando cambia el mes la lista entera se reemplaza y las filas
   nuevas entran TODAS a la vez con .transaction-item-enter-active de mas
   arriba, sin ninguna cascada. Delays cortos (40ms, no los 50ms del
   "appear" de arriba) porque ademas de "carga inicial" esto pasa cada vez
   que se toca la flecha del mes - se busca que se sienta agil, no lento.
   transition-delay (no animation-delay): .transaction-item-enter-active usa
   "transition", no "@keyframes animation". */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .transaction-list > .transaction-item-enter-active:nth-child(2) {
    transition-delay: 40ms;
  }

  .transaction-list > .transaction-item-enter-active:nth-child(3) {
    transition-delay: 80ms;
  }

  .transaction-list > .transaction-item-enter-active:nth-child(4) {
    transition-delay: 120ms;
  }

  .transaction-list > .transaction-item-enter-active:nth-child(n + 5) {
    transition-delay: 160ms;
  }
}
</style>
