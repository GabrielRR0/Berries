<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Goal, SavingsCapacity } from '../../services/goals/interfaces/goals.interface'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { availableBalance } from '../../utils/wallets/availableBalance'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import BaseCard from '../ui/BaseCard.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import PillToggle from '../ui/PillToggle.vue'
import GoalCheckInHistory from './GoalCheckInHistory.vue'
import GoalProgressRing from './GoalProgressRing.vue'
import GoalTypeIcon from './GoalTypeIcon.vue'

// Tarjeta de una meta individual (usada por GoalsMain.vue) - visual simple
// (pedido explicito del usuario, con captura de referencia): gauge + icono +
// reunido/restante + titulo + monto objetivo + dias restantes, sin nada de
// acciones a la vista. Todas las acciones (agregar aporte, ver historial,
// editar, abandonar, eliminar) viven detras de un menu de tres puntos en vez
// de una fila de botones siempre visible - antes cada accion competia por
// espacio permanente en la card, ahora la card en reposo es solo informacion.
const props = withDefaults(
  defineProps<{
    goal: Goal
    savingsCapacity?: SavingsCapacity | null
    wallets?: Wallet[]
    walletCommitments?: Record<string, number>
  }>(),
  {
    savingsCapacity: null,
    wallets: () => [],
    walletCommitments: () => ({}),
  },
)

const emit = defineEmits<{
  remove: []
  addContribution: [input: { amountSaved: number; walletId?: string; note?: string }]
  abandon: []
  edit: []
  checkInEdited: []
}>()

const progressPercent = computed(() => {
  if (props.goal.targetAmount <= 0) return 0
  return Math.min(100, Math.round((props.goal.totalSaved / props.goal.targetAmount) * 100))
})

const remainingAmount = computed(() => Math.max(0, props.goal.targetAmount - props.goal.totalSaved))

// Dias restantes hasta la fecha objetivo (nunca negativo - una meta vencida se
// muestra en 0, no con un numero negativo confuso).
const daysRemaining = computed(() => {
  const diffMs = new Date(props.goal.targetDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
})

// Mismo criterio informativo (nunca bloqueante) que CreateGoalWizard.vue -
// compara el aporte ya sugerido por el backend contra el disponible real
// promedio de los ultimos meses. hasEnoughHistory=false (cuenta nueva, el mes
// en curso todavia no termino) - pedido explicito del usuario, no mostrar esta
// advertencia con una sola cifra parcial que no es un promedio real.
const exceedsAvailable = computed(() => {
  if (!props.savingsCapacity?.hasEnoughHistory || props.goal.status !== 'active') return false
  return props.goal.suggestedMonthlyContribution > props.savingsCapacity.avgMonthlyAvailable
})

// Idea de la sesion de brainstorm de UI: "Abandonar" disparaba el evento
// directo desde el menu sin ningun paso intermedio, mientras "Eliminar" ya
// tenia la confirmacion de 2 pasos completa (footer de altura fija + pulso
// rojo) - inconsistente para dos acciones igual de "pesadas". Se generaliza
// el mismo footer para ambas en vez de duplicar el bloque entero.
const pendingAction = ref<'delete' | 'abandon' | null>(null)
const pendingActionText = computed(() =>
  pendingAction.value === 'abandon' ? '¿Abandonar meta?' : '¿Eliminar meta?',
)
function requestDelete() {
  pendingAction.value = 'delete'
}
function requestAbandon() {
  pendingAction.value = 'abandon'
}
function cancelPendingAction() {
  pendingAction.value = null
}
function confirmPendingAction() {
  const action = pendingAction.value
  pendingAction.value = null
  if (action === 'delete') emit('remove')
  else if (action === 'abandon') emit('abandon')
}

// Sheet de aporte - pedido explicito del usuario ("para cuando quiero agregar
// un aporte poder enlazarlo de alguna billetera que tenga"). Antes era un
// reveal inline (un solo numero no justificaba un formulario propio) - ya no
// aplica ese criterio ahora que suma billetera/nota.
const showAddContribution = ref(false)
const contributionAmount = ref('')
const contributionSourceType = ref<'wallet' | 'future'>('future')
const contributionWalletId = ref<string | null>(null)
const contributionNote = ref('')

function toggleAddContribution() {
  showAddContribution.value = !showAddContribution.value
  contributionAmount.value = ''
  contributionSourceType.value = 'future'
  contributionWalletId.value = null
  contributionNote.value = ''
}

// Solo billeteras de la MISMA moneda que la meta - pedido explicito del
// usuario, confirmado: sin conversion en esta pasada.
const walletsForContribution = computed(() => props.wallets.filter((wallet) => wallet.currency === props.goal.currency))

const contributionWalletAvailable = computed(() => {
  const wallet = walletsForContribution.value.find((w) => w.id === contributionWalletId.value)
  return wallet ? availableBalance(wallet, props.walletCommitments) : null
})

const canSubmitContribution = computed(() => {
  const amount = Number(contributionAmount.value)
  if (!Number.isFinite(amount) || amount <= 0) return false
  if (contributionSourceType.value !== 'wallet') return true
  if (contributionWalletId.value === null) return false
  return contributionWalletAvailable.value !== null && amount <= contributionWalletAvailable.value
})

function submitContribution() {
  if (!canSubmitContribution.value) return
  emit('addContribution', {
    amountSaved: Number(contributionAmount.value),
    walletId: contributionSourceType.value === 'wallet' ? (contributionWalletId.value ?? undefined) : undefined,
    note: contributionNote.value.trim() || undefined,
  })
  showAddContribution.value = false
  contributionAmount.value = ''
  contributionSourceType.value = 'future'
  contributionWalletId.value = null
  contributionNote.value = ''
}

// Historial carga perezosa: GoalCheckInHistory pide sus datos en su propio
// onMounted, asi que solo se monta (y solo entonces pide el historial)
// cuando el usuario lo abre - nunca junto con la lista general de metas.
const showHistory = ref(false)
function toggleHistory() {
  showHistory.value = !showHistory.value
}

// Menu de acciones (tres puntos). Bug real corregido: BaseCard usa
// backdrop-filter, que crea su propio contexto de apilamiento - un dropdown
// position:absolute (o hasta position:fixed) anidado ADENTRO de esa card nunca
// puede pintarse por encima de una card HERMANA que viene despues en el DOM, sin
// importar que z-index se le ponga (el z-index solo compite contra lo que
// comparte el mismo contexto de apilamiento). <Teleport to="body"> saca el
// dropdown de esa jerarquia por completo; su posicion se calcula a mano contra
// el boton disparador ya que, al teletransportarse, deja de estar cerca de el
// en el DOM.
const showMenu = ref(false)
const menuTriggerRef = ref<HTMLElement | null>(null)
const menuDropdownRef = ref<HTMLElement | null>(null)
const menuPosition = ref({ top: 0, right: 0 })

function toggleMenu() {
  if (!showMenu.value && menuTriggerRef.value) {
    const rect = menuTriggerRef.value.getBoundingClientRect()
    menuPosition.value = { top: rect.bottom + 6, right: window.innerWidth - rect.right }
  }
  showMenu.value = !showMenu.value
}

function onDocumentClick(event: MouseEvent) {
  if (!showMenu.value) return
  const target = event.target as Node
  if (menuTriggerRef.value?.contains(target) || menuDropdownRef.value?.contains(target)) return
  showMenu.value = false
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

function onMenuAddContribution() {
  showMenu.value = false
  toggleAddContribution()
}
function onMenuToggleHistory() {
  showMenu.value = false
  toggleHistory()
}
function onMenuEdit() {
  showMenu.value = false
  emit('edit')
}
function onMenuAbandon() {
  showMenu.value = false
  requestAbandon()
}
function onMenuDelete() {
  showMenu.value = false
  requestDelete()
}
</script>

<template>
  <BaseCard class="goal-card" :padded="false" :class="{ 'is-confirming-action': pendingAction !== null }">
    <div class="goal-top-row">
      <p v-if="goal.status === 'active'" class="goal-days-remaining">Faltan {{ daysRemaining }} días</p>

      <div class="goal-menu">
        <button ref="menuTriggerRef" type="button" class="goal-menu-trigger" aria-label="Más acciones" @click="toggleMenu">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="12" cy="19" r="1.75" />
          </svg>
        </button>

        <Teleport to="body">
          <Transition name="menu-reveal">
            <div
              v-if="showMenu"
              ref="menuDropdownRef"
              class="goal-menu-dropdown"
              role="menu"
              :style="{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }"
            >
              <button v-if="goal.status === 'active'" type="button" class="goal-menu-item" @click="onMenuAddContribution">
                + Agregar aporte
              </button>
              <button type="button" class="goal-menu-item" @click="onMenuToggleHistory">
                {{ showHistory ? 'Ocultar historial' : 'Ver historial' }}
              </button>
              <button v-if="goal.status === 'active'" type="button" class="goal-menu-item" @click="onMenuEdit">
                Editar
              </button>
              <button v-if="goal.status === 'active'" type="button" class="goal-menu-item" @click="onMenuAbandon">
                Abandonar
              </button>
              <button type="button" class="goal-menu-item danger" @click="onMenuDelete">Eliminar</button>
            </div>
          </Transition>
        </Teleport>
      </div>
    </div>

    <div class="goal-ring-glow" aria-hidden="true"></div>

    <div class="goal-ring-section">
      <GoalProgressRing :percent="progressPercent" :size="108" glow>
        <div class="goal-ring-content">
          <GoalTypeIcon :type="goal.goalType" class="goal-ring-icon" />
          <span class="goal-ring-percent">{{ progressPercent }}%</span>
        </div>
      </GoalProgressRing>

      <div class="goal-stats-grid">
        <div class="goal-stat-chip">
          <span class="goal-stat-label">Reunido</span>
          <span class="goal-stat-value">
            <AnimatedCurrency :value="goal.totalSaved" :currency="goal.currency" direction="up" />
          </span>
        </div>
        <div class="goal-stat-chip">
          <span class="goal-stat-label">Restante</span>
          <span class="goal-stat-value">{{ formatCurrency(remainingAmount, goal.currency) }}</span>
        </div>
      </div>
    </div>

    <div class="goal-header">
      <p class="goal-title">{{ goal.title }}</p>
      <span v-if="goal.status === 'completed'" class="goal-badge">Meta cumplida</span>
      <span v-else-if="goal.status === 'abandoned'" class="goal-badge abandoned">Abandonada</span>
    </div>

    <p v-if="goal.status === 'active'" class="goal-suggested">
      Aporte sugerido · <strong>{{ formatCurrency(goal.suggestedMonthlyContribution, goal.currency) }}/mes</strong>
    </p>

    <p v-if="exceedsAvailable" class="goal-capacity-warning">
      Supera tu disponible promedio ({{ formatCurrency(savingsCapacity?.avgMonthlyAvailable ?? 0, goal.currency) }}/mes).
    </p>

    <p v-if="goal.lastCheckInPostponed" class="goal-postponed-note" role="status">
      No se pudo cumplir el aporte de un mes, pero seguimos reuniendo para lograrlo.
    </p>

    <!-- <Teleport to="body">: mismo motivo que el menu de tres puntos de arriba -
         BaseCard usa backdrop-filter, un ancestro con eso redefine el containing
         block de un position:fixed anidado adentro (el .sheet-scrim de
         BottomSheet.vue). -->
    <Teleport to="body">
      <BottomSheet v-if="showAddContribution" title="Agregar aporte" @close="toggleAddContribution">
        <form class="goal-add-contribution-form" @submit.prevent="submitContribution">
          <input
            v-model="contributionAmount"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            placeholder="0.00"
            autofocus
          />

          <!-- De donde sale este aporte - pedido explicito del usuario: "puede
               ser de alguna billetera, o de un ingreso futuro". -->
          <PillToggle
            :options="[
              { value: 'wallet', label: 'Billetera' },
              { value: 'future', label: 'Ingreso futuro' },
            ]"
            v-model="contributionSourceType"
            class="goal-add-contribution-source-toggle"
          />

          <div v-if="contributionSourceType === 'wallet'" class="goal-add-contribution-wallet-field">
            <select v-model="contributionWalletId">
              <option :value="null" disabled>Elige una billetera</option>
              <option v-for="wallet in walletsForContribution" :key="wallet.id" :value="wallet.id">
                {{ wallet.name }} — disponible {{ formatCurrency(availableBalance(wallet, walletCommitments), wallet.currency) }}
              </option>
            </select>
            <p v-if="walletsForContribution.length === 0" class="goal-add-contribution-hint">
              No tienes billeteras en {{ goal.currency }} todavía.
            </p>
            <p
              v-else-if="contributionWalletId !== null && !canSubmitContribution"
              class="goal-add-contribution-hint warning"
            >
              Esa billetera no tiene disponible suficiente para este monto.
            </p>
          </div>
          <input
            v-else
            v-model="contributionNote"
            type="text"
            maxlength="500"
            placeholder="¿De dónde sale? (opcional)"
          />

          <div class="goal-add-contribution-actions">
            <button type="button" class="goal-add-contribution-cancel" @click="toggleAddContribution">Cancelar</button>
            <button type="submit" class="goal-add-contribution-confirm" :disabled="!canSubmitContribution">Sumar</button>
          </div>
        </form>
      </BottomSheet>
    </Teleport>

    <GoalCheckInHistory
      v-if="showHistory"
      :goal-id="goal.id"
      :currency="goal.currency"
      :wallets="wallets"
      :wallet-commitments="walletCommitments"
      class="goal-history-panel"
      @check-in-edited="emit('checkInEdited')"
    />

    <!-- Alto fijo mientras esta activo (mismo criterio que antes): confirmar
         borrado o abandono nunca mueve nada fuera de la card. -->
    <Transition name="confirm-reveal">
      <div v-if="pendingAction !== null" class="goal-confirm" role="alert">
        <span class="goal-confirm-text">{{ pendingActionText }}</span>
        <div class="goal-confirm-actions">
          <button type="button" class="goal-confirm-cancel" @click="cancelPendingAction">Cancelar</button>
          <button type="button" class="goal-confirm-delete" @click="confirmPendingAction">Confirmar</button>
        </div>
      </div>
    </Transition>
  </BaseCard>
</template>

<style scoped>
.goal-card {
  position: relative;
  /* Contiene el resplandor de .goal-ring-glow, que se dibuja mas grande que la
     card (a proposito, pedido explicito del usuario tras elegir esta
     direccion en un canvas de diseno) - sin esto se saldria del borde
     redondeado. box-shadow no se ve afectado (se pinta fuera del padding-box
     del propio elemento, overflow no lo recorta). */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* :padded="false" en BaseCard - padding propio y mas chico (pedido explicito
     del usuario: la card se veia "muy grande, poco profesional"), sin pelear
     por especificidad contra ".base-card.padded" de BaseCard.vue. */
  padding: 1.125rem;
  /* Ver comentario equivalente en DebtCard.vue/WalletCard.vue: el shorthand
     "transition" no se combina entre reglas de igual especificidad, hay que
     repetir la lista completa aca para que el hover de BaseCard.vue funcione
     sin importar el orden final del CSS compilado. */
  transition:
    border-color var(--duration-base) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

/* Resplandor detras del anillo (misma paleta --accent, sin color nuevo) -
   z-index negativo lo ubica DEBAJO del resto del contenido dentro del propio
   contexto de apilamiento de la card (BaseCard.vue ya crea uno via
   backdrop-filter), nunca encima pese a estar primero en el DOM: un
   position:absolute con z-index:auto se pinta despues del flujo normal, por
   eso hace falta el -1 explicito aca. */
.goal-ring-glow {
  position: absolute;
  z-index: -1;
  top: -3.75rem;
  left: 50%;
  transform: translateX(-50%);
  width: 16.25rem;
  height: 16.25rem;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(239, 68, 68, 0.17), transparent 65%);
  filter: blur(1.125rem);
  pointer-events: none;
}

.goal-ring-section {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.25rem;
}

.goal-ring-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1875rem;
}

.goal-ring-icon {
  width: 1.375rem;
  height: 1.375rem;
  color: var(--accent);
}

.goal-ring-percent {
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--text-h);
}

.goal-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  width: 100%;
  margin-top: 1.125rem;
}

.goal-stat-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  padding: 0.5625rem 0.6875rem;
  border-radius: var(--radius-sm);
  background: var(--bg-inset);
  text-align: center;
}

.goal-stat-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
}

.goal-stat-value {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-h);
}

.goal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.625rem;
}

.goal-title {
  width: 100%;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-h);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goal-badge {
  flex-shrink: 0;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
  font-size: 0.6875rem;
  font-weight: 600;
}

.goal-badge.abandoned {
  color: var(--text-muted);
}

.goal-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 1.75rem;
}

.goal-menu {
  position: relative;
  flex-shrink: 0;
  /* Siempre pegado al extremo derecho de la fila superior, exista o no texto
     de "dias restantes" al otro lado (meta completada/abandonada no lo
     muestra) - un margin auto en flex gana por sobre justify-content aunque
     este sea el unico hijo. */
  margin-left: auto;
}

.goal-menu-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--bg-raised);
  color: var(--text);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.goal-menu-trigger svg {
  width: 1.125rem;
  height: 1.125rem;
}

.goal-menu-trigger:hover {
  background: var(--border);
  color: var(--text-h);
}

/* position:fixed + top/right calculados a mano en JS (ver toggleMenu) - al
   vivir ahora bajo <body> (Teleport), ya no tiene ningun ancestro cerca para
   posicionarse relativo a el. */
.goal-menu-dropdown {
  position: fixed;
  z-index: 60;
  display: flex;
  flex-direction: column;
  min-width: 10rem;
  padding: 0.375rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--bg-raised);
  box-shadow: var(--shadow-md);
}

.goal-menu-item {
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-h);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.goal-menu-item:hover {
  background: var(--bg-inset);
}

.goal-menu-item.danger {
  color: var(--accent);
}

.menu-reveal-enter-active,
.menu-reveal-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.menu-reveal-enter-from,
.menu-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .menu-reveal-enter-active,
  .menu-reveal-leave-active {
    transition: opacity var(--duration-fast) linear;
  }

  .menu-reveal-enter-from,
  .menu-reveal-leave-to {
    transform: none;
  }
}

.goal-days-remaining {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.goal-suggested {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
}

.goal-suggested strong {
  font-weight: 700;
  color: var(--text);
}

.goal-capacity-warning {
  margin-top: 0.5rem;
  padding: 0.4375rem 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.6875rem;
  line-height: 1.4;
  text-align: center;
}

.goal-postponed-note {
  margin-top: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  text-align: center;
  color: var(--accent);
  font-size: 0.75rem;
  line-height: 1.4;
}

.goal-add-contribution-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.goal-add-contribution-form input,
.goal-add-contribution-wallet-field select {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
}

.goal-add-contribution-form input:focus,
.goal-add-contribution-wallet-field select:focus {
  outline: none;
  border-color: var(--accent);
}

.goal-add-contribution-source-toggle {
  align-self: flex-start;
}

.goal-add-contribution-wallet-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.goal-add-contribution-hint {
  padding: 0.4375rem 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--bg-inset);
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
}

.goal-add-contribution-hint.warning {
  border-color: var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
}

.goal-add-contribution-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.goal-add-contribution-confirm,
.goal-add-contribution-cancel {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.goal-add-contribution-confirm {
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
}

.goal-add-contribution-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.goal-add-contribution-cancel {
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
}

.goal-add-contribution-confirm:not(:disabled):hover,
.goal-add-contribution-cancel:hover {
  opacity: 0.9;
}

.goal-history-panel {
  margin-top: 0.75rem;
}

/* Pulso rojo de una sola vez al pedir confirmacion (eliminar o abandonar) -
   mismo criterio que DebtCard.vue/WalletCard.vue. */
.goal-card.is-confirming-action {
  border-color: var(--accent-border);
  animation: goal-danger-pulse 700ms var(--ease-out);
}

@keyframes goal-danger-pulse {
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
  .goal-card.is-confirming-action {
    animation: none;
  }
}

.goal-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
}

.goal-confirm-text {
  font-size: 0.8125rem;
  color: var(--text);
  white-space: nowrap;
}

.goal-confirm-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.goal-confirm-cancel,
.goal-confirm-delete {
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

.goal-confirm-cancel {
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
}

.goal-confirm-delete {
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
}

.goal-confirm-cancel:hover,
.goal-confirm-delete:hover {
  opacity: 0.9;
}

.goal-confirm-cancel:active,
.goal-confirm-delete:active {
  transform: scale(0.94);
}

/* Reveal minimalista (fade + 6px) - mismo criterio que DebtCard.vue/
   WalletCard.vue. */
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
