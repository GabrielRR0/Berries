<script lang="ts">
// <script setup> no puede tener exports en tiempo de ejecucion (solo
// tipos) - ver https://github.com/vuejs/rfcs/pull/227. DEFAULT_TRANSACTIONS_FILTER
// es un valor real (lo usan TransactionsMain.vue y TransactionsFilterPanel.vue
// como estado inicial), asi que vive en este bloque separado en vez del de
// abajo. Los TIPOS viven en interfaces/TransactionsFilterSheet.interface.ts,
// hermana de este archivo.
import type { TransactionsFilterState } from './interfaces/TransactionsFilterSheet.interface'

export const DEFAULT_TRANSACTIONS_FILTER: TransactionsFilterState = {
  type: 'all',
  period: 'month',
  category: null,
}
</script>

<script setup lang="ts">
// Bottom sheet de filtros de Movimientos - pedido explicito del usuario
// ("darle click al filtro hacer aparecer una box... con los filtros
// necesarios"). El contenido real (Tipo/Periodo/Categoria) vive en
// TransactionsFilterPanel.vue, compartido con el sidebar siempre-visible de
// escritorio (ver TransactionsMain.vue) - este archivo solo pone ese panel
// dentro del BottomSheet generico para mobile/tablet.
import BottomSheet from '../ui/BottomSheet.vue'
import TransactionsFilterPanel from './TransactionsFilterPanel.vue'

defineProps<{ modelValue: TransactionsFilterState; categories: string[] }>()
defineEmits<{ apply: [filter: TransactionsFilterState]; close: [] }>()
</script>

<template>
  <BottomSheet title="Filtros" @close="$emit('close')">
    <TransactionsFilterPanel :model-value="modelValue" :categories="categories" @apply="$emit('apply', $event)" />
  </BottomSheet>
</template>
