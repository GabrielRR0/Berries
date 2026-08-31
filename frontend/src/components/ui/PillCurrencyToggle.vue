<script setup lang="ts">
// Fila de chips tipo pill para elegir en que moneda se muestra el balance
// (USD/EUR/USDT en la captura de referencia "Rial"). Componente tonto:
// recibe la lista y el valor activo por props, emite update:modelValue -
// DashboardMain/BalanceCard deciden que hacer con el cambio.
defineProps<{ currencies: string[]; modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="pill-toggle" role="tablist">
    <button
      v-for="currency in currencies"
      :key="currency"
      type="button"
      class="pill"
      role="tab"
      :aria-selected="currency === modelValue"
      :class="{ active: currency === modelValue }"
      @click="$emit('update:modelValue', currency)"
    >
      {{ currency }}
    </button>
  </div>
</template>

<style scoped>
.pill-toggle {
  display: inline-flex;
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

/* Escala + opacidad juntas (no solo escala): un cambio de tamaño de 6-12% es
   facil de perderse en un tap rapido real - la caida de opacidad se nota de
   inmediato aunque el toque sea muy breve. */
.pill:active {
  transform: scale(0.88);
  opacity: 0.7;
}

/* Activa: se queda solida/vibrante a proposito (el unico acento de la app no
   se diluye en cristal) - el pill inactivo si es transparente sobre el
   track de cristal. */
.pill.active {
  background: var(--accent);
  color: var(--accent-contrast);
}
</style>
