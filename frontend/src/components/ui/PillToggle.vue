<script setup lang="ts">
// Toggle tipo pill generico donde valor y etiqueta pueden diferir (a
// diferencia de PillCurrencyToggle.vue, donde el valor ES la etiqueta -
// "USD", "EUR"). Usado por TransactionsFilterSheet.vue para Tipo/Periodo;
// deliberadamente un componente aparte en vez de generalizar
// PillCurrencyToggle - ese ya esta en uso en Inicio y no hace falta
// arriesgarlo para este caso nuevo.
defineProps<{ options: { value: string; label: string }[]; modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="pill-toggle" role="tablist">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="pill"
      role="tab"
      :aria-selected="option.value === modelValue"
      :class="{ active: option.value === modelValue }"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.pill-toggle {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: 1px solid var(--glass-border);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .pill-toggle {
    background: var(--bg-inset);
  }
}

.pill {
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

.pill:hover {
  color: var(--text-h);
}

.pill:active {
  transform: scale(0.88);
  opacity: 0.7;
}

.pill.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

/* Estilo de "segmented control" tipo Apple en escritorio (contenedor con
   esquinas menos redondeadas + segmentos casi cuadrados) en vez del pill
   completo de mobile - pedido explicito del usuario ("los inputs fuesen un
   poco mas cuadrados"). Mobile se queda exactamente igual (pill completo,
   ya aprobado). */
@media (min-width: 1024px) {
  .pill-toggle {
    border-radius: var(--radius-lg);
  }

  .pill {
    border-radius: var(--radius-sm);
  }
}
</style>
