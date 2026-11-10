<script setup lang="ts">
import { computed } from 'vue'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'

// Cabecera de Cuentas: patrimonio total (todas las billeteras convertidas a USD, ver
// useWalletsPortfolio.ts) y una barra que reparte ese total entre billeteras, para ver de un
// vistazo donde esta tu plata. `shares` son porcentajes ya redondeados por billetera.
const props = defineProps<{ wallets: Wallet[]; total: number; shares: Record<string, number> }>()

// Mas grande primero; las que pesan 0% no dibujan segmento (siguen en la lista de abajo).
const segments = computed(() =>
  props.wallets
    .map((wallet) => ({ id: wallet.id, name: wallet.name, share: props.shares[wallet.id] ?? 0 }))
    .filter((segment) => segment.share > 0)
    .sort((a, b) => b.share - a.share),
)

function toneFor(index: number): string {
  // Un solo acento (rojo), cada segmento un poco mas tenue que el anterior.
  return `rgba(var(--accent-bright-rgb), ${Math.max(0.22, 1 - index * 0.2)})`
}
</script>

<template>
  <section class="wallets-hero">
    <p class="wallets-hero-label">Patrimonio total</p>
    <p class="wallets-hero-amount">
      <AnimatedCurrency :value="total" currency="USD" />
    </p>
    <p class="wallets-hero-caption">
      {{ wallets.length }} {{ wallets.length === 1 ? 'billetera' : 'billeteras' }} · todo convertido a USD
    </p>

    <!-- Siempre presente (aunque aun no haya montos): si apareciera al llegar los datos la
         tarjeta crecia de golpe. -->
    <div class="wallets-hero-bar" role="img" aria-label="Cómo se reparte tu patrimonio entre billeteras">
      <span
        v-for="(segment, index) in segments"
        :key="segment.id"
        class="wallets-hero-segment"
        :style="{ width: `${segment.share}%`, background: toneFor(index) }"
      />
    </div>

    <ul class="wallets-hero-legend">
      <li v-for="(segment, index) in segments" :key="segment.id" class="wallets-hero-legend-item">
        <span class="wallets-hero-dot" :style="{ background: toneFor(index) }" aria-hidden="true" />
        <span class="wallets-hero-legend-name">{{ segment.name }}</span>
        <span class="wallets-hero-legend-share">{{ segment.share }}%</span>
      </li>
    </ul>
  </section>
</template>

<style scoped src="./walletsHero.css"></style>
