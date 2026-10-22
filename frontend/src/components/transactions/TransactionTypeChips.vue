<script setup lang="ts">
import { ref } from 'vue'
import { useSlidingIndicator } from '../../animation/useSlidingIndicator'
import type { TransactionTypeFilter } from './interfaces/TransactionsFilterSheet.interface'

// Chips de tipo (Todos / Gastos / Ingresos / Transferencias) bajo la busqueda
// de Movimientos: el mismo filtro "type" que ya vive en el sheet de filtros,
// pero a un toque de distancia. Tonto a proposito - el estado es de
// TransactionsMain.vue, aca solo se pinta y se emite.
const props = defineProps<{ modelValue: TransactionTypeFilter }>()
defineEmits<{ 'update:modelValue': [value: TransactionTypeFilter] }>()

// La pastilla activa se desliza con un resorte (animation/useSlidingIndicator.ts).
const container = ref<HTMLElement | null>(null)
const indicator = ref<HTMLElement | null>(null)
useSlidingIndicator(container, indicator, () => props.modelValue)

// "short": etiqueta para movil, donde 4 partes iguales no alcanzan para "Transferencias".
const OPTIONS: { value: TransactionTypeFilter; label: string; short?: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'transfer', label: 'Transferencias', short: 'Transf.' },
]
</script>

<template>
  <div ref="container" class="type-chips" role="group" aria-label="Filtrar por tipo">
    <span ref="indicator" class="type-chip-indicator" aria-hidden="true" />
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      class="type-chip"
      :class="{ active: option.value === modelValue }"
      :aria-pressed="option.value === modelValue"
      :data-active="option.value === modelValue"
      @click="$emit('update:modelValue', option.value)"
    >
      <template v-if="option.short">
        <span class="type-chip-short">{{ option.short }}</span>
        <span class="type-chip-long">{{ option.label }}</span>
      </template>
      <template v-else>{{ option.label }}</template>
    </button>
  </div>
</template>

<style scoped src="./transactionTypeChips.css"></style>
