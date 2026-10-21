<script setup lang="ts">
import { computed, toRef } from 'vue'
import { vGrowBar } from '../../animation/vGrowBar'
import { useWalletsPortfolio } from '../../composables/dashboard/useWalletsPortfolio'
import { useCurrencyStore } from '../../stores/currency.store'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'
import BaseCard from '../ui/BaseCard.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'

// Seccion "Mis cuentas" de Inicio: carrusel horizontal de tarjetas (una por
// wallet) con el patrimonio total arriba y, en cada una, su peso sobre ese
// total. Tonta a proposito: recibe las wallets ya cargadas (DashboardMain
// solo LEE el wallets.store compartido) y avisa con "open" cuando el usuario
// quiere ir a /cuentas, donde vive el detalle y la creacion real.
const props = defineProps<{ wallets: Wallet[]; isLoading: boolean }>()
const emit = defineEmits<{ open: [] }>()

const currencyStore = useCurrencyStore()
const displayCurrency = computed(() => currencyStore.displayCurrency)
const { total, shares } = useWalletsPortfolio(toRef(props, 'wallets'), displayCurrency)
</script>

<template>
  <section class="wallets-carousel">
    <div class="wallets-header">
      <h2 class="wallets-title">Mis cuentas</h2>
      <!-- Manda a /cuentas (WalletsMain.vue) - ahi vive la creacion real de
           wallets, ver componentes bajo components/wallets/. -->
      <button type="button" class="wallets-fab" aria-label="Agregar billetera" @click="emit('open')">
        <!-- SVG en vez del glyph de texto "+" - un caracter de texto no queda
             perfectamente centrado dentro de un circulo flex (la metrica de la
             fuente no coincide con el centro visual real del simbolo), un SVG
             con paths propios si. -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <Transition name="loading-fade" mode="out-in">
      <LoadingIndicator v-if="isLoading && wallets.length === 0" key="loading" label="Cargando billeteras..." />

      <BaseCard v-else-if="wallets.length === 0" key="empty" class="wallets-empty">
        <p class="wallets-empty-title">Todavía no tienes billeteras</p>
        <p class="wallets-empty-text">
          Crea tu primera billetera para empezar a llevar tus cuentas en distintas monedas.
        </p>
      </BaseCard>

      <div v-else key="list">
        <p class="wallets-total">
          Patrimonio total
          <strong class="wallets-total-amount">
            <AnimatedCurrency :value="total" :currency="displayCurrency" />
          </strong>
        </p>

        <!-- El degradado oscuro del borde derecho (::after de .wallets-track,
             ver walletsCarousel.css) hace que las tarjetas aparezcan y
             desaparezcan de una sombra al deslizar. -->
        <div class="wallets-track">
          <ul class="wallets-preview-list">
            <li
              v-for="wallet in wallets"
              :key="wallet.id"
              class="wallets-preview-item"
              role="button"
              tabindex="0"
              @click="emit('open')"
              @keydown.enter="emit('open')"
              @keydown.space.prevent="emit('open')"
            >
              <div class="wallets-preview-top">
                <span class="wallets-preview-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="6" width="18" height="13" rx="2" />
                    <path d="M3 10h18" />
                    <path d="M16 15h2" stroke-linecap="round" />
                  </svg>
                </span>
                <span class="wallets-preview-currency">{{ wallet.currency }}</span>
              </div>
              <div>
                <span class="wallets-preview-name">{{ wallet.name }}</span>
                <span class="wallets-preview-balance">
                  <AnimatedCurrency :value="wallet.balance" :currency="wallet.currency" />
                </span>
              </div>
              <div class="wallets-preview-share">
                <span class="wallets-preview-bar" aria-hidden="true">
                  <span v-grow-bar="(shares[wallet.id] ?? 0) / 100" class="wallets-preview-bar-fill" />
                </span>
                <span class="wallets-preview-percent">{{ shares[wallet.id] ?? 0 }}% del total</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped src="./walletsCarousel.css"></style>
