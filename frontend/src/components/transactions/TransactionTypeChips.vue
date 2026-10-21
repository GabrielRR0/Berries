<script setup lang="ts">
import type { TransactionTypeFilter } from './interfaces/TransactionsFilterSheet.interface'

// Chips de tipo (Todos / Gastos / Ingresos / Transferencias) bajo la busqueda
// de Movimientos: el mismo filtro "type" que ya vive en el sheet de filtros,
// pero a un toque de distancia. Tonto a proposito - el estado es de
// TransactionsMain.vue, aca solo se pinta y se emite.
defineProps<{ modelValue: TransactionTypeFilter }>()
defineEmits<{ 'update:modelValue': [value: TransactionTypeFilter] }>()

const OPTIONS: { value: TransactionTypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'transfer', label: 'Transferencias' },
]
</script>

<template>
  <div class="type-chips" role="group" aria-label="Filtrar por tipo">
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      class="type-chip"
      :class="{ active: option.value === modelValue }"
      :aria-pressed="option.value === modelValue"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped src="./transactionTypeChips.css"></style>
