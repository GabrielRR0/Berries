<script setup lang="ts">
withDefaults(defineProps<{ disabled?: boolean; variant?: 'primary' | 'secondary'; size?: 'md' | 'sm' }>(), {
  variant: 'primary',
  size: 'md',
})
defineEmits<{ click: [] }>()
</script>

<template>
  <button class="base-button" :class="[variant, size]" :disabled="disabled" @click="$emit('click')">
    <slot />
  </button>
</template>

<style scoped>
.base-button {
  padding: 0.875rem 1.75rem;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    background-color var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out);
}

.base-button.sm {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
}

/* Unico color solido de la app (aparte de negro/blanco): el CTA primario -
   DESIGN.md #2/#6, con rojo como acento en vez de gris oscuro. */
.base-button.primary {
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
}

.base-button.secondary {
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  color: var(--text-h);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .base-button.secondary {
    background: var(--bg-surface);
  }
}

.base-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.base-button:not(:disabled):hover {
  opacity: 0.9;
}

.base-button:not(:disabled):active {
  transform: scale(0.95);
  opacity: 0.85;
}
</style>
