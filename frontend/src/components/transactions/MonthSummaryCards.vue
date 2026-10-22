<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDirectionalSwap } from '../../animation/useDirectionalSwap'
import { vGrowBar } from '../../animation/vGrowBar'
import AnimatedCurrency from '../ui/AnimatedCurrency.vue'

// Resumen del MES ACTIVO en Movimientos (ver MonthPager.vue en
// TransactionsMain.vue): balance destacado + barra de cuanto de lo ingresado
// se gasto + Ingresos/Gastos. Puramente informativo, sin click. En movil es
// UNA tarjeta; en escritorio se reparte en tres (ver monthSummaryCards.css).
// Los contadores son opcionales: solo escritorio muestra "N movimientos este mes".
// El slot "pager" es el selector de mes de la version movil (dentro de la tarjeta).
const props = defineProps<{ income: number; expenses: number; currency: string; incomeCount?: number; expenseCount?: number; monthStamp?: number }>()

// Al cambiar de mes (monthStamp sube/baja) el balance y los mosaicos entran deslizando
// desde el lado hacia el que se avanza (animation/useDirectionalSwap.ts).
const root = ref<HTMLElement | null>(null)
useDirectionalSwap(root, () => props.monthStamp, { selector: '[data-month-part]' })

function countCaption(count: number | undefined): string | null {
  if (count === undefined) return null
  return `${count} ${count === 1 ? 'movimiento' : 'movimientos'} este mes`
}

const balance = computed(() => props.income - props.expenses)
// Sin ingresos no hay proporcion que mostrar: la barra queda vacia.
const spentPercent = computed(() =>
  props.income > 0 ? Math.min(100, Math.round((props.expenses / props.income) * 100)) : 0,
)
</script>

<template>
  <div ref="root" class="month-summary-cards">
    <div class="hero-pager"><slot name="pager" /></div>

    <div class="hero-balance" data-month-part>
      <p class="hero-label">Balance del mes</p>
      <p class="hero-balance-amount summary-amount">
        <span v-if="balance > 0" aria-hidden="true">+</span><AnimatedCurrency :value="balance" :currency="currency" direction="up" />
      </p>
      <!-- Siempre presentes (aunque aun no haya ingresos): si aparecieran al llegar los
           datos, la tarjeta crecia de golpe y empujaba toda la pantalla hacia abajo. -->
      <div class="hero-bar" role="img" :aria-label="`Gastaste el ${spentPercent}% de tus ingresos`">
        <div v-grow-bar="spentPercent / 100" class="hero-bar-fill" />
      </div>
      <p v-if="income > 0" class="hero-caption">
        Gastaste el <strong>{{ spentPercent }}%</strong> de lo que ingresó <span class="hero-caption-extra">este mes</span>
      </p>
      <p v-else class="hero-caption">Sin ingresos registrados este mes</p>
    </div>

    <div class="hero-tile" data-month-part>
      <p class="hero-tile-label">
        <span class="hero-tile-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
            <path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        Ingresos
      </p>
      <p class="hero-tile-amount summary-amount">
        <AnimatedCurrency :value="income" :currency="currency" direction="up" />
      </p>
      <p v-if="countCaption(incomeCount)" class="hero-tile-count">{{ countCaption(incomeCount) }}</p>
    </div>

    <div class="hero-tile expense" data-month-part>
      <p class="hero-tile-label">
        <span class="hero-tile-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
            <path d="M12 5v14M6 13l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        Gastos
      </p>
      <p class="hero-tile-amount summary-amount expense">
        <AnimatedCurrency :value="expenses" :currency="currency" direction="down" />
      </p>
      <p v-if="countCaption(expenseCount)" class="hero-tile-count">{{ countCaption(expenseCount) }}</p>
    </div>
  </div>
</template>

<style scoped src="./monthSummaryCards.css"></style>
