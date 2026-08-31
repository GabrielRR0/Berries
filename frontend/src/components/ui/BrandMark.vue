<script setup lang="ts">
// Marca de Berries (moneda de tesoro + huesos en X + "$" grabado) - mismo
// diseño ya usado en favicon.png/icon-192.png/icon-512.png (ver
// frontend/public/), reproducido acá como SVG inline para que se vea nítido
// a cualquier tamaño dentro de la UI (TopHeader.vue, LoginForm.vue,
// RegisterWizard.vue). El "$" y el anillo interior van en --bg (no negro
// fijo) porque siempre se dibuja sobre el fondo real de la app, nunca sobre
// su propio tile opaco.
withDefaults(defineProps<{ size?: string }>(), { size: '1.5rem' })
</script>

<template>
  <svg
    class="brand-mark"
    :style="{ width: size, height: size }"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <rect x="3" y="11.35" width="18" height="1.3" rx="0.65" fill="var(--accent)" transform="rotate(45 12 12)" />
    <rect x="3" y="11.35" width="18" height="1.3" rx="0.65" fill="var(--accent)" transform="rotate(-45 12 12)" />
    <circle cx="18.36" cy="18.36" r="1.9" fill="var(--accent)" />
    <circle cx="5.64" cy="5.64" r="1.9" fill="var(--accent)" />
    <circle cx="18.36" cy="5.64" r="1.9" fill="var(--accent)" />
    <circle cx="5.64" cy="18.36" r="1.9" fill="var(--accent)" />
    <circle cx="12" cy="12" r="6.6" fill="var(--accent)" />
    <circle cx="12" cy="12" r="5.1" fill="none" stroke="var(--bg)" stroke-width="0.9" />
    <text
      x="12"
      y="12.15"
      font-size="7.8"
      font-weight="800"
      text-anchor="middle"
      dominant-baseline="central"
      fill="var(--bg)"
      font-family="Arial, Helvetica, sans-serif"
    >$</text>
  </svg>
</template>

<style scoped>
.brand-mark {
  flex-shrink: 0;
}
</style>
