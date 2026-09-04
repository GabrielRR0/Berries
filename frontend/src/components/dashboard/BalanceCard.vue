<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useCurrency } from '../../composables/currency/useCurrency'
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
const { convert } = useCurrency()

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
const totalBalance = ref(0)
const eyeButtonRef = ref<HTMLElement | null>(null)

const showCoachMark = computed(() => currentStep.value?.id === 'balance-visibility')
// Pedido explicito del usuario: cuando este paso se activa, hay que
// scrollear hasta el boton del ojo (por si el usuario ya bajo la pagina
// antes de tocar "?") y señalarlo bien, no solo mostrar el texto flotando.
useScrollIntoViewOnActive(eyeButtonRef, showCoachMark)

async function recomputeTotal() {
  const target = currencyStore.displayCurrency
  let sum = 0
  for (const wallet of walletsStore.wallets) {
    if (wallet.currency === target) {
      sum += wallet.balance
      continue
    }
    try {
      const result = await convert(wallet.balance, wallet.currency, target)
      sum += result.convertedAmount
    } catch {
      // Best-effort: si la conversion de esta wallet falla, cuenta 0 en el
      // total en vez de romper el resto de la suma.
    }
  }
  totalBalance.value = sum
}

onMounted(async () => {
  await walletsStore.fetchWallets().catch(() => {
    // Error ya reflejado en walletsStore.error; la tarjeta sigue mostrando 0.
  })
  await recomputeTotal()
})

watch(() => currencyStore.displayCurrency, recomputeTotal)
watch(() => walletsStore.wallets, recomputeTotal)

function toggleHidden() {
  balanceHidden.value = !balanceHidden.value
  localStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, String(balanceHidden.value))
}
</script>

<template>
  <div class="balance-card">
    <BalanceTrendBackdrop />

    <div class="balance-header">
      <span class="balance-label">Mi balance</span>
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

    <PillCurrencyToggle
      :model-value="currencyStore.displayCurrency"
      class="balance-currency-toggle"
      :currencies="visibleCurrencies"
      @update:model-value="currencyStore.setDisplayCurrency($event)"
    />
  </div>
</template>

<style scoped>
.balance-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  /* "Banner inicial" - pedido explicito del usuario: esta tarjeta (monto +
     delta + pills de moneda + BalanceTrendBackdrop de fondo) es su propio
     bloque hero, empujando QuickActionsGrid hacia abajo - no solo lo que
     ocupa el contenido. 46vh se sintio exagerado ("demasiado exagerado");
     30vh es el punto correcto. El contenido queda arriba
     (align-items:flex-start ya existente) y el grafico de fondo llena el
     resto del alto (se adapta solo via height:100% en
     BalanceTrendBackdrop.vue). */
  min-height: 30dvh;
  min-height: 30vh;
}

.balance-header {
  position: relative;
  /* width:100% (no shrink-to-fit) - el mismo bug de ancho colapsado que
     .balance-summary ya evitaba: .balance-card usa align-items:flex-start,
     asi que sin esto un hijo flex como este solo mediria lo que ocupan
     label+boton (unos 100px), no el ancho completo de la card. */
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.balance-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
}

.eye-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-base) var(--ease-out);
}

/* Anillo rojo - mismo criterio que .tour-active de QuickActionsGrid.vue:
   pedido explicito del usuario ("señalar bien cual accion anda
   explicando"). Sin esto el texto flotante del tour no dejaba claro a que
   apuntaba en este paso especificamente. */
.eye-button.is-tour-active {
  box-shadow: 0 0 0 2px var(--accent);
  color: var(--accent);
}

.eye-button svg {
  width: 1.125rem;
  height: 1.125rem;
}

.eye-button:hover {
  color: var(--text-h);
}

.balance-coach-mark {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  z-index: 5;
}

.balance-amount {
  /* Piso mas alto que antes - pedido explicito del usuario: en tlf/tablet
     el monto debe tener mas presencia/destacar mas. */
  font-size: clamp(2.8rem, 9vw, 3.25rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-h);
}

/* clamp() de arriba ya toca su techo (3.25rem) a partir de ~578px de ancho -
   se ve identico en tablet que en un monitor 4K. El numero grande es el
   momento hero de la pantalla, se le da mas presencia real en escritorio en
   vez de dejarlo topeado. */
@media (min-width: 1024px) {
  .balance-amount {
    font-size: clamp(3.5rem, 2.4rem + 1.8vw, 4.5rem);
  }
}

/* LoadingIndicator centra su contenido por default (pensado para ocupar una
   seccion entera) - aca reemplaza solo el monto, alineado a la izquierda
   como el resto de la card (align-items:flex-start de .balance-card). */
.balance-loading {
  justify-content: flex-start;
  padding: 0.5rem 0;
}

.balance-currency-toggle {
  margin-top: 0.5rem;
}

/* En mobile esta card se queda como "hero" flotante sin chrome propio
   (pedido explicito del usuario en su momento). En escritorio, al lado de
   cards con fondo/borde reales (Ingresos/Gastos, Mis balances), quedaba
   como el unico bloque "flotando en el vacio" sin superficie propia - se le
   agrega el mismo lenguaje glass del resto de la app (fondo + borde +
   padding), sin tocar nada de layout interno. */
@media (min-width: 1024px) {
  .balance-card {
    padding: 2rem 2rem 0;
    /* Un poco mas de aire que en mobile (min-height:30dvh, base de arriba) -
       pedido explicito del usuario. Mas moderado que el primer intento
       (24rem, se veia raro) - ver el comentario de ".balance-trend-backdrop"
       mas abajo sobre POR QUE se veia raro y como se compenso aca. */
    min-height: 22rem;
    border-radius: var(--radius-lg);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    backdrop-filter: blur(var(--blur-sm));
    -webkit-backdrop-filter: blur(var(--blur-sm));
    overflow: hidden;
  }

  /* BalanceTrendBackdrop.vue esta pensado para "sangrar" mas alla del borde
     de la card (left/top negativos + width/height calc, ver ese archivo) -
     en mobile alcanza con -1.25rem porque la card no tiene padding propio
     (el grafico sigue de largo hasta el padding de PageShell). Ahora que la
     card tiene padding real (2rem arriba/izq/der, 0 abajo) + borde +
     overflow:hidden, el offset tiene que ser -2rem (no -1.25rem) para
     cancelar exactamente ese padding y que el grafico llegue justo al borde
     real de la card, no mas corto (quedaba clipeado antes de tocar el
     borde) ni mas largo (se recortaria de mas).
     Selector calificado como ".balance-card .balance-trend-backdrop" (no
     ".balance-trend-backdrop" solo) a proposito: aunque el mecanismo de
     "el scope del padre alcanza la raiz del hijo" hace que un selector de
     una sola clase tambien matchee, ese selector quedaria con la MISMA
     especificidad que la regla propia de BalanceTrendBackdrop.vue (una
     clase + un atributo de scope cada uno) - un empate que el navegador
     resuelve por orden de aparicion en el CSS ya compilado/bundleado, no
     necesariamente a favor de esta regla (confirmado en vivo: sin este
     calificador extra, el override no se aplicaba). Calificar con
     ".balance-card" agrega una clase + un atributo de scope mas, ganando
     siempre sin depender del orden del bundle. */
  /* Vertical: -1.5rem, no -2rem (que cancelaria el padding-top de 2rem
     exacto) - a proposito se deja 0.5rem de aire de mas: el punto brilloso
     del final de la curva (circulo de radio 9 unidades de viewBox, con blur)
     necesita un margen real arriba de la curva o su glow queda pegado al
     limite de "overflow:hidden" de la card y se ve cortado (confirmado en
     vivo). Horizontal se queda exacto (-2rem) porque ahi el punto SI llega
     bien al borde derecho sin recortarse. */
  .balance-card .balance-trend-backdrop {
    top: -1.5rem;
    left: -2rem;
    height: calc(100% + 1.5rem);
    width: calc(100% + 4rem);
  }
}
</style>
