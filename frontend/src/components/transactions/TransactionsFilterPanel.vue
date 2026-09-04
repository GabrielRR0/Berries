<script setup lang="ts">
// Contenido real de los filtros de Movimientos (Tipo/Periodo/Categoria) -
// extraido de TransactionsFilterSheet.vue para poder mostrarlo tanto dentro
// de ese bottom sheet (mobile/tablet) como en un sidebar siempre visible en
// escritorio (ver TransactionsMain.vue, pedido explicito del usuario de
// layout multi-columna). Los tipos vuelven a vivir en
// interfaces/TransactionsFilterSheet.interface.ts, hermana de este archivo.
import { computed, ref, watch } from 'vue'
import BaseButton from '../ui/BaseButton.vue'
import PillToggle from '../ui/PillToggle.vue'
import { DEFAULT_TRANSACTIONS_FILTER } from './TransactionsFilterSheet.vue'
import type {
  TransactionPeriodFilter,
  TransactionTypeFilter,
  TransactionsFilterState,
} from './interfaces/TransactionsFilterSheet.interface'

const props = defineProps<{ modelValue: TransactionsFilterState; categories: string[] }>()
const emit = defineEmits<{ apply: [filter: TransactionsFilterState] }>()

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'transfer', label: 'Transferencias' },
]

const PERIOD_OPTIONS = [
  { value: 'month', label: 'Todo el mes' },
  { value: '7', label: '7 días' },
  { value: '15', label: '15 días' },
  { value: '30', label: '30 días' },
]

// Idea de la sesion de brainstorm de UI: antes Tipo/Periodo/Categoria solo
// se aplicaban al tocar "Filtrar", mientras el buscador de texto (
// TransactionsMain.vue) ya filtraba en vivo - una inconsistencia real entre
// dos formas de filtrar la misma lista. Ahora los tres aplican en vivo, cada
// tap emite "apply" de inmediato (igual criterio que el buscador), sin
// boton "Filtrar" ni cierre automatico del sheet en mobile - el usuario
// cierra el sheet cuando quiere, no como efecto secundario de filtrar.
const draftType = ref<TransactionTypeFilter>(props.modelValue.type)
const draftPeriod = ref<TransactionPeriodFilter>(props.modelValue.period)
const draftCategory = ref<string | null>(props.modelValue.category)
const categorySearch = ref('')

// A diferencia del bottom sheet original (que se monta entero via v-if cada
// vez que se abre, asi que siempre arranca fresco), la instancia de
// escritorio de este panel vive SIEMPRE montada en el sidebar - sin este
// watch, tocar "Limpiar" resetea el filtro real pero los PillToggle se
// quedan mostrando la seleccion vieja.
watch(
  () => props.modelValue,
  (value) => {
    draftType.value = value.type
    draftPeriod.value = value.period
    draftCategory.value = value.category
  },
)

const visibleCategories = computed(() => {
  const query = categorySearch.value.trim().toLowerCase()
  if (!query) return props.categories
  return props.categories.filter((category) => category.toLowerCase().includes(query))
})

function applyDraft() {
  emit('apply', { type: draftType.value, period: draftPeriod.value, category: draftCategory.value })
}

function onTypeChange(value: string) {
  draftType.value = value as TransactionTypeFilter
  applyDraft()
}

function onPeriodChange(value: string) {
  draftPeriod.value = value as TransactionPeriodFilter
  applyDraft()
}

function selectCategory(category: string | null) {
  draftCategory.value = draftCategory.value === category ? null : category
  applyDraft()
}

function onClear() {
  draftType.value = DEFAULT_TRANSACTIONS_FILTER.type
  draftPeriod.value = DEFAULT_TRANSACTIONS_FILTER.period
  draftCategory.value = DEFAULT_TRANSACTIONS_FILTER.category
  emit('apply', { ...DEFAULT_TRANSACTIONS_FILTER })
}
</script>

<template>
  <div class="filter-panel">
    <div class="filter-group">
      <span class="filter-group-label">Tipo</span>
      <PillToggle :options="TYPE_OPTIONS" :model-value="draftType" @update:model-value="onTypeChange" />
    </div>

    <div class="filter-group">
      <span class="filter-group-label">Período</span>
      <PillToggle :options="PERIOD_OPTIONS" :model-value="draftPeriod" @update:model-value="onPeriodChange" />
    </div>

    <div class="filter-group">
      <span class="filter-group-label">Categoría</span>
      <input v-model="categorySearch" type="search" class="category-search" placeholder="Buscar categoría..." />
      <div class="category-chips">
        <button
          type="button"
          class="category-chip"
          :class="{ active: draftCategory === null }"
          @click="selectCategory(null)"
        >
          Todas
        </button>
        <button
          v-for="category in visibleCategories"
          :key="category"
          type="button"
          class="category-chip"
          :class="{ active: draftCategory === category }"
          @click="selectCategory(category)"
        >
          {{ category }}
        </button>
        <p v-if="visibleCategories.length === 0" class="category-empty">Sin coincidencias.</p>
      </div>
    </div>

    <div class="filter-actions">
      <BaseButton type="button" variant="secondary" size="sm" @click="onClear">Limpiar</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.filter-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.filter-group-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.category-search {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  /* 1rem, no menos: por debajo de 16px iOS Safari hace zoom automatico al
     enfocar un input - rompe la sensacion de app nativa. */
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.category-search:focus {
  outline: none;
  border-color: var(--accent);
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.category-chip {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: capitalize;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.category-chip:active {
  transform: scale(0.94);
}

.category-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
}

.category-empty {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
