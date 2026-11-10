<script setup lang="ts">
import { computed } from 'vue'
import { useListStaggerTransition } from '../../animation/useListStaggerTransition'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import type { StatsPeriod, TransferRouteStat } from '../../utils/wallets/transferStats'
import { statsPeriodCaption } from '../../utils/wallets/transferStats'

// "Dónde pagas comisiones": una fila por ruta (origen -> destino) con cuantas transferencias
// se hicieron, cuantas llevaron comision y cuanto costaron, ordenadas de mas a menos caras.
// mode "usd" (Cuentas, mezcla monedas) muestra el valor en USD; "native" (cartola) la moneda
// de la propia billetera. La barra compara cada ruta con la mas cara.
const props = withDefaults(
  defineProps<{ routes: TransferRouteStat[]; period: StatsPeriod; mode?: 'usd' | 'native'; limit?: number }>(),
  { mode: 'usd', limit: 5 },
)

const rowTransition = useListStaggerTransition()

function feeValue(route: TransferRouteStat): number {
  return props.mode === 'usd' ? (route.feeUsd ?? 0) : route.feeNative
}

const visible = computed(() => props.routes.slice(0, props.limit))
const maxFee = computed(() => Math.max(0, ...visible.value.map(feeValue)))

function feeText(route: TransferRouteStat): string {
  if (route.feeCount === 0) return 'Sin comisión'
  if (props.mode === 'native' || route.feeUsd === null) return formatCurrency(route.feeNative, route.feeCurrency)
  return formatCurrency(route.feeUsd, 'USD')
}

function barWidth(route: TransferRouteStat): string {
  return maxFee.value > 0 ? `${Math.max(4, Math.round((feeValue(route) / maxFee.value) * 100))}%` : '0%'
}

function detail(route: TransferRouteStat): string {
  const transfers = `${route.count} ${route.count === 1 ? 'transferencia' : 'transferencias'}`
  if (route.feeCount === 0) return transfers
  // Una comision por transferencia: el promedio dice cuanto cuesta cada una.
  const average = route.feeNative / route.feeCount
  return `${transfers} · ${formatCurrency(average, route.feeCurrency)} por comisión`
}
</script>

<template>
  <section class="route-fees">
    <h2 class="route-fees-title">Comisiones por ruta</h2>
    <p class="route-fees-subtitle">Cuánto pagaste al mover plata entre billeteras {{ statsPeriodCaption(period) }}</p>

    <!-- Alto minimo reservado: con o sin rutas la tarjeta no salta al cambiar el periodo. -->
    <div class="route-fees-body">
      <p v-if="visible.length === 0" class="route-fees-empty">No hay transferencias {{ statsPeriodCaption(period) }}.</p>
      <TransitionGroup
        v-else
        tag="ul"
        name="route-row"
        class="route-fees-list"
        :css="false"
        appear
        @before-enter="rowTransition.onBeforeEnter"
        @enter="rowTransition.onEnter"
        @leave="rowTransition.onLeave"
      >
        <li v-for="(route, index) in visible" :key="route.key" class="route-row" :data-order="index">
          <div class="route-row-head">
            <span class="route-row-name">{{ route.fromName }} <span class="route-row-arrow">→</span> {{ route.toName }}</span>
            <span class="route-row-fee" :class="{ none: route.feeCount === 0 }">{{ feeText(route) }}</span>
          </div>
          <div class="route-row-bar" aria-hidden="true">
            <span class="route-row-bar-fill" :style="{ width: barWidth(route) }" />
          </div>
          <p class="route-row-detail">{{ detail(route) }}</p>
        </li>
      </TransitionGroup>
    </div>
  </section>
</template>

<style scoped src="./routeFeesCard.css"></style>
