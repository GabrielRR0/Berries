<script setup lang="ts">
// Interruptor booleano estilo iOS - no existia un componente de switch en la
// UI todavia (los toggles previos, ej. PillToggle.vue, son selectores de
// varias opciones, no un on/off).
defineProps<{ modelValue: boolean; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="toggle-switch-row">
    <span class="toggle-switch-label">{{ label }}</span>
    <button
      type="button"
      class="toggle-switch"
      :class="{ active: modelValue }"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span class="toggle-switch-thumb" />
    </button>
  </label>
</template>

<style scoped>
.toggle-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.toggle-switch-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
}

.toggle-switch {
  position: relative;
  flex-shrink: 0;
  width: 2.75rem;
  height: 1.625rem;
  padding: 0;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--bg-inset);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.toggle-switch.active {
  background: var(--accent);
  border-color: var(--accent);
}

.toggle-switch-thumb {
  position: absolute;
  top: 0.125rem;
  left: 0.125rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: var(--accent-contrast);
  transition: transform var(--duration-fast) var(--ease-out);
}

.toggle-switch.active .toggle-switch-thumb {
  transform: translateX(1.125rem);
}

@media (prefers-reduced-motion: reduce) {
  .toggle-switch,
  .toggle-switch-thumb {
    transition: none;
  }
}
</style>
