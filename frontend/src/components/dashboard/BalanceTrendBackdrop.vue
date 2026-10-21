<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { animate } from '../../animation/motion'
import { drawPath } from '../../animation/drawPath'
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
const pathRef = ref<SVGPathElement | null>(null)
const areaRef = ref<SVGPathElement | null>(null)
const dotsRef = ref<SVGGElement | null>(null)
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

  ready.value = true

  if (playReveal) {
    await nextTick()
    revealTrend()
  }
})

// Secuencia de "dibujado" con Motion (ver animation/): la linea se traza de
// punta a punta y, cuando va casi terminando, aparecen el relleno y el
// punto del final. Los estados iniciales (relleno/punto ocultos) se
// declaran en el template solo cuando playReveal es true, para que no haya
// un destello del grafico completo antes de animar.
function revealTrend() {
  if (pathRef.value) drawPath(pathRef.value, 1.2)
  if (areaRef.value) animate(areaRef.value, { opacity: [0, 1] }, { duration: 0.7, delay: 0.95 })
  if (dotsRef.value) animate(dotsRef.value, { opacity: [0, 1], scale: [0.6, 1] }, { duration: 0.5, delay: 1.1 })
}
</script>

<template>
  <svg
    v-if="ready"
    class="balance-trend-backdrop"
    :viewBox="`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="balance-trend-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.38" />
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path
      ref="areaRef"
      class="balance-trend-area"
      :d="areaPath"
      fill="url(#balance-trend-fill)"
      :style="{ opacity: playReveal ? 0 : 1 }"
    />
    <path ref="pathRef" class="balance-trend-line" :d="linePath" fill="none" />
    <g v-if="linePath" ref="dotsRef" class="balance-trend-dots" :style="{ opacity: playReveal ? 0 : 1 }">
      <circle class="balance-trend-dot-glow" r="9" :cx="endPoint[0]" :cy="endPoint[1]" />
      <circle class="balance-trend-dot-core" r="4" :cx="endPoint[0]" :cy="endPoint[1]" />
    </g>
  </svg>
</template>

<style scoped src="./balanceTrendBackdrop.css"></style>
