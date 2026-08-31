<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { shouldPlayTrendReveal } from '../../composables/dashboard/useTrendReveal'
import { useTransactionsStore } from '../../stores/transactions.store'
import { buildTrendPath } from '../../utils/charts/buildTrendPath'

// Grafico de tendencia de fondo detras del balance - pedido explicito del
// usuario ("nuestro propio grafico... que haga ver viva la app"), disenado y
// aprobado primero como mockup via el skill /design antes de construirlo
// aca. Estilo propio (no la referencia "Rial"): curva con glow rojo en
// capas, no una linea plana.
const VIEWBOX_WIDTH = 340
const VIEWBOX_HEIGHT = 176

// Forma de respaldo (mismo look "montañoso" del mockup aprobado) para
// cuentas nuevas sin movimientos este mes todavia - asi el fondo nunca se
// ve "muerto" (una linea plana) aunque no haya datos reales que graficar.
const FALLBACK_VALUES = [0, 8, 5, 14, 9, 19, 13, 24, 17, 29, 33]

const linePath = ref('')
const areaPath = ref('')
const endPoint = ref<[number, number]>([VIEWBOX_WIDTH, VIEWBOX_HEIGHT / 2])
const pathLength = ref(1300)
const pathRef = ref<SVGPathElement | null>(null)
// Decidido ANTES de calcular/renderizar el path, no despues - si no, se ve
// un flash de la linea completa antes de "resetearse" a escondida para
// animar (confirmado al implementar el bottom sheet - mismo tipo de bug).
const playReveal = shouldPlayTrendReveal()
const ready = ref(false)

const transactionsStore = useTransactionsStore()

function isThisMonth(occurredAt: string): boolean {
  const now = new Date()
  const date = new Date(occurredAt)
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

async function computeTrend(): Promise<number[]> {
  try {
    // Lee de la cache compartida (transactions.store.ts) en vez de su
    // propio listTransactions({dateFrom, dateTo}) - pedido explicito del
    // usuario de cachear los datos entre pantallas/visitas. El filtro de
    // "este mes" se hace aca, en el cliente.
    await transactionsStore.fetchTransactions()
    const sorted = [...transactionsStore.transactions]
      .filter((transaction) => isThisMonth(transaction.occurredAt))
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    if (sorted.length < 3) return FALLBACK_VALUES

    let running = 0
    const series = [0]
    // Suma el monto crudo sin convertir moneda: esta linea es textura de
    // fondo puramente decorativa (nunca se muestra un valor junto a ella),
    // asi que la forma relativa importa, no la precision entre monedas -
    // convertir cada transaccion aca solo agregaria llamadas de red sin
    // beneficio real.
    for (const transaction of sorted) {
      running += transaction.type === 'income' ? transaction.amount : -transaction.amount
      series.push(running)
    }
    return series
  } catch {
    // Fondo decorativo: si falla el fetch, cae a la forma de respaldo en
    // vez de mostrar un error o dejar la seccion vacia.
    return FALLBACK_VALUES
  }
}

onMounted(async () => {
  const values = await computeTrend()
  const { linePath: line, areaPath: area, endPoint: end } = buildTrendPath(values, VIEWBOX_WIDTH, VIEWBOX_HEIGHT)
  linePath.value = line
  areaPath.value = area
  endPoint.value = end

  if (playReveal) {
    await nextTick()
    if (pathRef.value) {
      pathLength.value = pathRef.value.getTotalLength()
    }
  }
  ready.value = true
})
</script>

<template>
  <svg
    v-if="ready"
    class="balance-trend-backdrop"
    :class="{ 'is-revealing': playReveal }"
    :viewBox="`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="balance-trend-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.34" />
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path class="balance-trend-area" :d="areaPath" fill="url(#balance-trend-fill)" />
    <path
      ref="pathRef"
      class="balance-trend-line"
      :d="linePath"
      fill="none"
      :style="{ strokeDasharray: pathLength, strokeDashoffset: playReveal ? pathLength : 0 }"
    />
    <template v-if="linePath">
      <circle class="balance-trend-dot-glow" r="9" :cx="endPoint[0]" :cy="endPoint[1]" />
      <circle class="balance-trend-dot-core" r="4" :cx="endPoint[0]" :cy="endPoint[1]" />
    </template>
  </svg>
</template>

<style scoped>
.balance-trend-backdrop {
  position: absolute;
  top: -0.75rem;
  left: -1.25rem;
  /* Alto explicito EN PORCENTAJE (no "auto", no un rem fijo): un <svg> es un
     elemento "replaced" (como <img>), asi que height:auto se resuelve por
     el aspect-ratio del viewBox en vez de por "top+bottom" como en un div
     comun - fijar "bottom" sin esto no tenia ningun efecto (confirmado
     midiendo con Playwright). Ahora que .balance-card es el "banner
     inicial" con casi la mitad de la pantalla de alto (pedido explicito
     del usuario), este grafico tiene que llenar TODO ese alto, no un valor
     fijo pensado para la card chica de antes - por eso 100% (mas el
     "+0.75rem" para compensar el "top" negativo de arriba, asi el borde de
     abajo cae justo en el borde de la card, no 0.75rem mas arriba). */
  height: calc(100% + 0.75rem);
  /* "width" explicito, no "right" - mismo motivo que el comentario de
     "height" de arriba: al ser un elemento "replaced", left+right SIN un
     width explicito NO fuerza el estirado cuando el alto ya es definido -
     el navegador calcula el ancho por el aspect-ratio del viewBox (340/176)
     en vez de estirarse hasta "right". Con un alto chico (mobile) ese ancho
     calculado por ratio puede superar el ancho real de la card sin que se
     note a simple vista (el exceso sangra afuera, invisible); con un alto
     mucho mas chico relativo al ancho (card ancha de escritorio) el ancho
     calculado por ratio queda muy por DEBAJO del ancho real - un bug latente
     que recien se hizo visible ahi (el grafico no llegaba al borde
     derecho). "width" explicito saca la ambiguedad del todo. */
  width: calc(100% + 2.5rem);
  pointer-events: none;
  overflow: visible;
}

.balance-trend-line {
  stroke: var(--accent);
  stroke-width: 2.25;
  stroke-linecap: round;
  opacity: 0.95;
  filter:
    drop-shadow(0 0 3px rgba(239, 68, 68, 0.9))
    drop-shadow(0 0 16px rgba(239, 68, 68, 0.65))
    drop-shadow(0 0 34px rgba(239, 68, 68, 0.35));
}

.balance-trend-area {
  opacity: 0;
  transition: opacity var(--duration-base) var(--ease-out);
}

.balance-trend-dot-glow {
  fill: var(--accent);
  opacity: 0.55;
  filter: blur(3px);
}

.balance-trend-dot-core {
  fill: var(--accent);
  filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.95));
}

/* Animacion de "trazo" solo en visitas frescas (ver script) - en
   tab-switches rapidos el grafico ya esta ahi, quieto, sin repetir el
   efecto cada vez. */
@media (prefers-reduced-motion: no-preference) {
  .is-revealing .balance-trend-line {
    animation: balance-trend-draw 1200ms var(--ease-slide) forwards;
  }

  .is-revealing .balance-trend-area {
    animation: balance-trend-fade-in 700ms var(--ease-out) 950ms forwards;
  }

  .is-revealing .balance-trend-dot-glow,
  .is-revealing .balance-trend-dot-core {
    animation: balance-trend-dot-pulse 900ms var(--ease-out) 1100ms forwards;
  }
}

.balance-trend-dot-glow,
.balance-trend-dot-core {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
}

.balance-trend-backdrop:not(.is-revealing) .balance-trend-area {
  opacity: 1;
}

.balance-trend-backdrop:not(.is-revealing) .balance-trend-dot-glow {
  opacity: 0.55;
}

.balance-trend-backdrop:not(.is-revealing) .balance-trend-dot-core {
  opacity: 1;
}

@keyframes balance-trend-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes balance-trend-fade-in {
  to {
    opacity: 1;
  }
}

@keyframes balance-trend-dot-pulse {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }
  60% {
    opacity: 1;
    transform: scale(1.3);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .balance-trend-area,
  .balance-trend-dot-glow,
  .balance-trend-dot-core {
    opacity: 1;
  }

  .balance-trend-dot-glow {
    opacity: 0.55;
  }
}
</style>
