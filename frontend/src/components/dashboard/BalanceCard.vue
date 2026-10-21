<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useWalletsPortfolio } from '../../composables/dashboard/useWalletsPortfolio'
import { useOnboardingTour } from '../../composables/onboarding/useOnboardingTour'
import { useScrollIntoViewOnActive } from '../../composables/onboarding/useScrollIntoViewOnActive'
import { useCurrencyStore } from '../../stores/currency.store'
import { useWalletsStore } from '../../stores/wallets.store'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import CoachMarkTooltip from '../ui/CoachMarkTooltip.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import PillCurrencyToggle from '../ui/PillCurrencyToggle.vue'
import BalanceTrendBackdrop from './BalanceTrendBackdrop.vue'

// Balance real: suma los balances de todas las wallets del usuario
// (wallets.store), convertidos a la moneda de visualizacion activa
// (currency.store) via useCurrency. Si la conversion de alguna wallet falla,
// esa wallet cuenta como 0 en el total (suma "best effort", no rompe toda la
// tarjeta - ver plan de Berry) en vez de propagar el error hacia arriba.
const props = withDefaults(
  defineProps<{
    currencies?: string[]
  }>(),
  {
    currencies: () => ['USD', 'EUR', 'USDT'],
  },
)

// Clave separada del resto del storage de la app (sin prefijo compartido
// todavia) - solo persiste esta preferencia puntual.
const BALANCE_HIDDEN_STORAGE_KEY = 'berry.balanceHidden'

const walletsStore = useWalletsStore()
const currencyStore = useCurrencyStore()

// Bug real reportado por el usuario ("si el cliente tiene... algun peso"):
// si la moneda principal del usuario no esta entre las 3 "comunes" de arriba
// (ej. COP, ARS), ningun pill quedaba marcado como activo - y ademas no
// habia forma de volver a esa moneda una vez tocado otro pill (no estaba
// ni siquiera ofrecida como opcion). Se antepone la moneda real del usuario
// a la lista recibida por props si todavia no esta ahi, sin sacar ninguna de
// las originales.
const visibleCurrencies = computed(() => {
  const current = currencyStore.displayCurrency
  return props.currencies.includes(current) ? props.currencies : [current, ...props.currencies]
})
// Ya no es un hint automatico al cargar: ahora es el paso 1 del tour guiado
// de Inicio, disparado desde el "?" del header (ver useOnboardingTour.ts) -
// pedido explicito del usuario.
const { currentStep, stepPosition, isFirstStep, isLastStep, next, back, close } = useOnboardingTour()

const balanceHidden = ref(localStorage.getItem(BALANCE_HIDDEN_STORAGE_KEY) === 'true')

// Idea de la sesion de brainstorm de UI: sin esto, el monto grande mostraba
// "$0.00" real (no un placeholder) mientras las wallets todavia cargaban -
// en una conexion lenta, un usuario podia leer eso como su balance real.
// Solo cuenta como "cargando" el momento ANTES de tener el primer dato (no
// cada recarga posterior, ej. al cambiar de moneda) - mismo criterio que
// WalletsMain.vue/TransactionsMain.vue.
const isInitialLoading = computed(() => walletsStore.isLoading && walletsStore.wallets.length === 0)
const { total: totalBalance } = useWalletsPortfolio(
  computed(() => walletsStore.wallets),
  computed(() => currencyStore.displayCurrency),
)
const eyeButtonRef = ref<HTMLElement | null>(null)

const showCoachMark = computed(() => currentStep.value?.id === 'balance-visibility')
// Pedido explicito del usuario: cuando este paso se activa, hay que
// scrollear hasta el boton del ojo (por si el usuario ya bajo la pagina
// antes de tocar "?") y señalarlo bien, no solo mostrar el texto flotando.
useScrollIntoViewOnActive(eyeButtonRef, showCoachMark)

onMounted(() => {
  walletsStore.fetchWallets().catch(() => {
    // Error ya reflejado en walletsStore.error; la tarjeta sigue mostrando 0.
  })
})

function toggleHidden() {
  balanceHidden.value = !balanceHidden.value
  localStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, String(balanceHidden.value))
}
</script>

<template>
  <div class="balance-card">
    <BalanceTrendBackdrop />

    <div class="balance-header">
      <span class="balance-label">Balance total</span>
      <button
        ref="eyeButtonRef"
        type="button"
        class="eye-button"
        :class="{ 'is-tour-active': showCoachMark }"
        :aria-label="balanceHidden ? 'Mostrar balance' : 'Ocultar balance'"
        @click="toggleHidden"
      >
        <svg v-if="balanceHidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M3 3l18 18M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5M9.4 5.5A9.9 9.9 0 0 1 12 5c5 0 8.5 3.5 9.9 7-.5 1.2-1.2 2.4-2.2 3.4M6.2 6.9C4.4 8.2 3.1 9.9 2.1 12c1.4 3.5 4.9 7 9.9 7 1.2 0 2.3-.2 3.4-.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2.1 12c1.4-3.5 4.9-7 9.9-7s8.5 3.5 9.9 7c-1.4 3.5-4.9 7-9.9 7s-8.5-3.5-9.9-7Z" stroke-linejoin="round" />
          <circle cx="12" cy="12" r="2.75" />
        </svg>
      </button>

      <!-- Flotante (position:absolute), NO en flujo normal - antes empujaba
           el PillCurrencyToggle de abajo en vez de superponerse. Ancla a
           .balance-header (con width:100% mas abajo, no shrink-to-fit) en
           vez de a .balance-summary - pedido explicito del usuario: "debe
           apuntar mejor la box, mas cerca del ojo" - antes flotaba debajo
           del monto grande, bien lejos del ojo que esta aca en el header.
           arrow-offset corrido para que la flechita apunte mas cerca del
           boton real (no del borde izquierdo generico del card). -->
      <CoachMarkTooltip
        v-if="showCoachMark && currentStep"
        class="balance-coach-mark"
        arrow-offset="5.25rem"
        :title="currentStep.title"
        :text="currentStep.text"
        :step-label="stepPosition"
        :show-back="!isFirstStep"
        :next-label="isLastStep ? 'Entendido' : 'Continuar'"
        @dismiss="close"
        @back="back"
        @next="next"
      />

      <PillCurrencyToggle
        :model-value="currencyStore.displayCurrency"
        class="balance-currency-toggle"
        :currencies="visibleCurrencies"
        @update:model-value="currencyStore.setDisplayCurrency($event)"
      />
    </div>

    <div class="balance-summary">
      <LoadingIndicator v-if="isInitialLoading" class="balance-loading" size="1.5rem" />
      <p v-else class="balance-amount">
        <span v-if="balanceHidden">••••••</span>
        <AnimatedCurrency
          v-else
          :value="totalBalance"
          :currency="currencyStore.displayCurrency"
          direction="up"
          compact-suffix
        />
      </p>
    </div>
  </div>
</template>

<style scoped src="./balanceCard.css"></style>
