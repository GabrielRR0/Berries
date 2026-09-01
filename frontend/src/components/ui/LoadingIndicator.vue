<script setup lang="ts">
// Reemplaza el texto suelto "Cargando..." que habia en varias pantallas
// (Metas, Deudas, Movimientos, etc.) - pedido explicito del usuario: un
// <p> de texto plano se veia poco profesional para una app que busca
// sentirse nativa. El spinner es solo CSS (sin libreria), y el
// aparecer/desaparecer fluido lo da el <Transition name="loading-fade">
// que envuelve a este componente en cada pantalla (ver style.css) - no
// se puede animar la desaparicion de un v-if sin un <Transition> real.
withDefaults(defineProps<{ label?: string; size?: string }>(), {
  label: undefined,
  size: '1.25rem',
})
</script>

<template>
  <div class="loading-indicator" role="status">
    <span class="loading-spinner" :style="{ '--spinner-size': size }" aria-hidden="true" />
    <span v-if="label">{{ label }}</span>
  </div>
</template>

<style scoped>
.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 1.5rem 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.loading-spinner {
  width: var(--spinner-size);
  height: var(--spinner-size);
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  animation: loading-spinner-rotate 0.7s linear infinite;
}

@keyframes loading-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation-duration: 1.6s;
  }
}
</style>
