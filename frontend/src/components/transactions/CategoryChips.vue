<script setup lang="ts">
import { computed } from 'vue'
import type { CategoryBreakdown } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { trimZeroDecimals } from '../../utils/transactions/categorySegments'

// Fila deslizable de categorias del mes con su total de gastos (movil): un
// toque filtra el historial por esa categoria, otro lo quita. Los datos son el
// mismo desglose que alimenta CategoryBreakdownCard.vue (escritorio).
const props = defineProps<{ breakdown: CategoryBreakdown[]; currency: string; modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [category: string | null] }>()

const items = computed(() => [...props.breakdown].sort((a, b) => b.total - a.total))

function select(category: string | null) {
  emit('update:modelValue', props.modelValue === category ? null : category)
}
</script>

<template>
  <div class="category-chips" role="group" aria-label="Filtrar por categoría">
    <button type="button" class="category-chip" :class="{ active: modelValue === null }" @click="emit('update:modelValue', null)">
      Todas
    </button>
    <button
      v-for="item in items"
      :key="item.category"
      type="button"
      class="category-chip"
      :class="{ active: modelValue === item.category }"
      :aria-pressed="modelValue === item.category"
      @click="select(item.category)"
    >
      <span class="category-chip-name">{{ item.category }}</span>
      <span class="category-chip-total">{{ trimZeroDecimals(formatCurrency(item.total, currency)) }}</span>
    </button>
  </div>
</template>

<style scoped src="./categoryChips.css"></style>
