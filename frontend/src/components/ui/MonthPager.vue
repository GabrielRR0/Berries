<script setup lang="ts">
// Pager de mes generico y reutilizable ("<" / mes+año / ">"). Tonto a
// proposito: recibe year/month (month 0-indexado, igual que Date/Intl) y
// emite el par siguiente - quien lo use decide que hacer con el cambio
// (ej. re-filtrar una lista ya cacheada en memoria, sin pedir nada a red).
import { computed } from 'vue'
import { formatMonthYear } from '../../utils/formatters/formatDate'

const props = defineProps<{ year: number; month: number }>()
const emit = defineEmits<{ change: [year: number, month: number] }>()

const label = computed(() => formatMonthYear(props.year, props.month))

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
  <div class="month-pager">
    <button type="button" class="month-pager-arrow" aria-label="Mes anterior" @click="goToPrevious">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 5 8 12l7 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <span class="month-pager-label">{{ label }}</span>
    <button type="button" class="month-pager-arrow" aria-label="Mes siguiente" @click="goToNext">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.month-pager {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: 1px solid var(--glass-border);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .month-pager {
    background: var(--bg-inset);
  }
}

.month-pager-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.month-pager-arrow svg {
  width: 1rem;
  height: 1rem;
}

.month-pager-arrow:hover {
  color: var(--text-h);
  background: var(--bg-inset);
}

.month-pager-arrow:active {
  transform: scale(0.88);
}

.month-pager-label {
  min-width: 8.5rem;
  text-align: center;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-h);
}
</style>
