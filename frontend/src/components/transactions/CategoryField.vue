<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useCategories } from '../../composables/categories/useCategories'
import type { TransactionType } from '../../services/transactions/interfaces/transactions.interface'

// Campo de categoria compartido entre TransactionForm.vue (alta manual) y
// DraftReviewCard.vue (revision de borrador por voz/OCR) - pedido explicito
// del usuario de tener categorias fijas configurables en Ajustes, pero sin
// perder la flexibilidad de texto libre que el campo ya tenia: autocompletar
// con chips (mismo lenguaje visual que category-chip en
// TransactionsFilterPanel.vue) + un chip "+ Crear" cuando lo escrito no
// matchea ninguna categoria existente, que crea la categoria ahi mismo (ver
// useCategories.ts) ademas de poder gestionarlas en Ajustes.
const props = defineProps<{ modelValue: string; kind: TransactionType }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { categories, fetchCategories, create: createCategory } = useCategories()
const creating = ref(false)

const text = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

onMounted(() => fetchCategories(props.kind))
watch(
  () => props.kind,
  (kind) => fetchCategories(kind),
)

const trimmedText = computed(() => text.value.trim())

// Chips de sugerencia: filtra por lo ya escrito (si hay algo), limitado a un puñado
// para no ensuciar el formulario - no es un dropdown flotante (sin z-index/blur que
// manejar), mismo criterio simple que el resto de Berry.
const suggestions = computed(() => {
  const query = trimmedText.value.toLowerCase()
  const list = query ? categories.value.filter((category) => category.name.toLowerCase().includes(query)) : categories.value
  return list.slice(0, 8)
})

const canCreate = computed(() => {
  if (!trimmedText.value) return false
  return !categories.value.some((category) => category.name.toLowerCase() === trimmedText.value.toLowerCase())
})

function selectSuggestion(name: string) {
  text.value = name
}

async function onCreate() {
  if (creating.value) return
  creating.value = true
  try {
    const created = await createCategory({ name: trimmedText.value, kind: props.kind })
    text.value = created.name
  } catch {
    // Si falla, el texto libre ya escrito sigue ahi tal cual - el usuario puede
    // igual confirmar el movimiento con esa categoria como texto plano, sin
    // que quede formalizada en la lista.
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="category-field">
    <label class="field">
      <span class="field-label">Categoría</span>
      <input v-model="text" type="text" required maxlength="80" placeholder="Ej. Mercado" />
    </label>

    <div v-if="suggestions.length > 0 || canCreate" class="category-suggestions">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion.id"
        type="button"
        class="category-chip"
        :class="{ active: suggestion.name === text }"
        @click="selectSuggestion(suggestion.name)"
      >
        {{ suggestion.name }}
      </button>
      <button v-if="canCreate" type="button" class="category-chip create" :disabled="creating" @click="onCreate">
        {{ creating ? 'Creando...' : `+ Crear "${trimmedText}"` }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.category-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.field input {
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field input:focus {
  outline: none;
  border-color: var(--accent);
}

.category-suggestions {
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
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out),
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

.category-chip.create {
  border-style: dashed;
  color: var(--accent);
}

.category-chip.create:disabled {
  opacity: 0.7;
  cursor: default;
}
</style>
