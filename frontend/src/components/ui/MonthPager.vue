<script setup lang="ts">
// Pager de mes generico y reutilizable ("<" / mes+año / ">"). Tonto a
// proposito: recibe year/month (month 0-indexado, igual que Date/Intl) y
// emite el par siguiente - quien lo use decide que hacer con el cambio
// (ej. re-filtrar una lista ya cacheada en memoria, sin pedir nada a red).
import { computed, ref } from 'vue'
import { useDirectionalSwap } from '../../animation/useDirectionalSwap'
import { formatMonthYear } from '../../utils/formatters/formatDate'

// variant: "pill" (default, pastilla chica), "hero" (movil, dentro del resumen del
// mes) y "toolbar" (barra superior de escritorio). Los dos ultimos deshabilitan
// la flecha siguiente en el mes actual - no hay movimientos del futuro que ver.
const props = withDefaults(defineProps<{ year: number; month: number; variant?: 'pill' | 'hero' | 'toolbar' }>(), {
  variant: 'pill',
})
const emit = defineEmits<{ change: [year: number, month: number] }>()

// La etiqueta del mes se desliza hacia el lado al que se navega.
const root = ref<HTMLElement | null>(null)
useDirectionalSwap(root, () => props.year * 12 + props.month, {
  selector: '.month-pager-label',
  distance: 14,
  step: 0,
})

const label = computed(() => formatMonthYear(props.year, props.month))
const isCurrentMonth = computed(() => {
  const today = new Date()
  return props.year * 12 + props.month >= today.getFullYear() * 12 + today.getMonth()
})
const nextDisabled = computed(() => props.variant !== 'pill' && isCurrentMonth.value)

function goToPrevious() {
  if (props.month === 0) emit('change', props.year - 1, 11)
  else emit('change', props.year, props.month - 1)
}

function goToNext() {
  if (props.month === 11) emit('change', props.year + 1, 0)
  else emit('change', props.year, props.month + 1)
}
</script>

<template>
  <div ref="root" class="month-pager" :class="variant">
    <button type="button" class="month-pager-arrow" aria-label="Mes anterior" @click="goToPrevious">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 5 8 12l7 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <span v-if="variant === 'hero'" class="month-pager-heading">
      <span class="month-pager-label">{{ label }}</span>
      <span class="month-pager-caption">{{ isCurrentMonth ? 'Mes actual' : 'Historial' }}</span>
    </span>
    <span v-else class="month-pager-label">{{ label }}</span>
    <button type="button" class="month-pager-arrow" aria-label="Mes siguiente" :disabled="nextDisabled" @click="goToNext">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped src="./monthPager.css"></style>
