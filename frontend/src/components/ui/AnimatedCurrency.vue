<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { padDigitsToLength, parseFormattedAmount } from '../../utils/formatters/parseFormattedAmount'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import OdometerDigit from './OdometerDigit.vue'

// Monto animado tipo "odometro" (pedido explicito del usuario: no un numero
// que solo suma rapido, sino cada digito deslizandose hasta asentarse, como
// un reloj/odometro mecanico antiguo). Reutilizable en cualquier parte de
// la app que muestre un monto - ver BalanceCard.vue/IncomeExpenseSummary.vue
// (uso directo) y DashboardMain.vue/WalletCard.vue (dentro de un v-for, que
// no puede llamar un composable por iteracion).
//
// "direction": 'up' (default, balance/ingresos) arranca desde un valor mas
// chico y sube; 'down' (gastos) arranca desde uno mas grande y "resta"
// hasta llegar al real - pedido explicito del usuario, no se infiere del
// signo (los gastos se guardan como magnitud positiva).
const props = withDefaults(
  defineProps<{
    value: number
    currency: string
    direction?: 'up' | 'down'
    /** Achica el sufijo de letras (ej. "USDT") relativo al numero - pensado
     * para contextos con fuente gigante (BalanceCard.vue), donde un sufijo
     * al mismo tamaño se ve enorme y ensancha todo el monto. La regla vive
     * ACA (no en quien usa el componente) porque el <span> del sufijo se
     * renderiza dentro del scope de ESTE componente - una clase inyectada
     * desde afuera no podria aplicarle estilos scoped del padre. */
    compactSuffix?: boolean
  }>(),
  { direction: 'up', compactSuffix: false },
)

const targetFormatted = computed(() => formatCurrency(props.value, props.currency))
const targetParsed = computed(() => parseFormattedAmount(targetFormatted.value))

// Los digitos que se estan mostrando AHORA - arrancan en el "punto de
// partida" (ver getStartValue) y una vez montados se actualizan al valor
// real, disparando la transicion CSS de cada OdometerDigit.
const displayDigits = ref<number[]>([])

function getStartValue(finalValue: number, direction: 'up' | 'down'): number {
  if (direction === 'up') return 0
  const magnitude = Math.abs(finalValue)
  return finalValue + Math.max(magnitude * 0.35, 25)
}

// Bug real (encontrado midiendo con Playwright, no leyendo el codigo): el
// watcher dispara una vez "immediate" al montar (value en su estado inicial,
// normalmente 0) y otra vez cuando llega el valor real del fetch - esas dos
// llamadas async a animateToTarget quedan superpuestas (la primera sigue
// esperando su nextTick/rAF cuando la segunda ya arranco), y la que
// "gana" al final es la que se resuelve ultimo, no necesariamente la mas
// nueva - el resultado se veia como un roll que quedaba pisado/atascado a
// mitad de camino mucho mas de lo que dura la transicion. Se resuelve
// ignorando cualquier invocacion que ya no sea la mas reciente.
let latestRequestId = 0

async function animateToTarget() {
  const requestId = ++latestRequestId
  const digitCount = targetParsed.value.digits.length
  const startValue = getStartValue(props.value, props.direction)
  const finalDigits = targetParsed.value.digits
  displayDigits.value = padDigitsToLength(startValue, digitCount)

  // Un frame de respiro antes de saltar al valor real - si se asignan los
  // dos valores en el mismo tick, Vue nunca pinta el estado "de partida" y
  // no hay nada que transicionar (los OdometerDigit ya nacerian mostrando
  // el valor final, sin rodar).
  await nextTick()
  if (requestId !== latestRequestId) return

  requestAnimationFrame(() => {
    if (requestId !== latestRequestId) return
    displayDigits.value = finalDigits
  })
}

watch(() => props.value, animateToTarget, { immediate: true })

function separatorAfter(index: number): string | null {
  const match = targetParsed.value.separators.find((s) => s.afterDigitIndex === index + 1)
  return match?.char ?? null
}
</script>

<template>
  <span class="animated-currency">
    <span class="animated-currency-visual" aria-hidden="true">
      <span v-if="targetParsed.prefix">{{ targetParsed.prefix }}</span>
      <template v-for="(digit, index) in displayDigits" :key="index">
        <OdometerDigit :digit="digit" />
        <span v-if="separatorAfter(index)">{{ separatorAfter(index) }}</span>
      </template>
      <span v-if="targetParsed.suffix" :class="{ 'animated-currency-suffix-compact': compactSuffix }">{{
        targetParsed.suffix
      }}</span>
    </span>
    <!-- El odometro es puramente decorativo/animado - un lector de pantalla
         no deberia leer digito por digito mientras rueda. El valor final
         real queda disponible aca, oculto visualmente. -->
    <span class="animated-currency-sr-only">{{ targetFormatted }}</span>
  </span>
</template>

<style scoped>
/* Bug real (reportado por el usuario con captura): las comas/puntos
   separadores son texto plano, que se alinea por defecto a
   vertical-align:baseline - pero OdometerDigit es un inline-block con
   overflow:hidden (su contenido es un flex column recortado, no texto
   normal), asi que su "baseline" no coincide con la de un caracter comun y
   quedaba visualmente mas arriba que las comas/puntos, que se veian
   "caidos". Envolver todo en un flex inline con align-items:baseline
   fuerza a que digitos y separadores compartan la MISMA linea base en vez
   de que cada uno resuelva su alineacion por su cuenta.  */
.animated-currency-visual {
  display: inline-flex;
  align-items: baseline;
}

/* Punto intermedio entre el numero y el signo de moneda (pedido explicito
   del usuario): ni tan grande como el monto (se comería toda la fila en
   tablet/telefono con codigos de 3-4 letras como USDT), ni tan chico que se
   pierda que es una unidad. Solo se activa con compact-suffix (ver arriba)
   - en contextos con fuente ya modesta (wallets, ingresos/gastos) reducir
   mas la letra la haria illegible. */
.animated-currency-suffix-compact {
  margin-left: 0.3em;
  font-size: 0.34em;
  font-weight: 600;
  color: var(--text-muted);
}

.animated-currency-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
