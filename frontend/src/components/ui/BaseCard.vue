<script setup lang="ts">
// Cristal por default (pedido explicito del usuario: "todo, incluyendo
// listas") - "strong" es un blur/opacidad mayor para lo que flota sobre
// contenido (modales, popovers), donde conviene leerse mas solido.
withDefaults(defineProps<{ padded?: boolean; variant?: 'glass' | 'glass-strong' }>(), {
  padded: true,
  variant: 'glass',
})
</script>

<template>
  <div class="base-card" :class="[variant, { padded }]">
    <slot />
  </div>
</template>

<style scoped>
/* Superficie traslucida + blur (cristal tipo Apple) en vez de un fondo solido
   - regla de Berry de "nunca borde Y sombra marcada a la vez" sigue
   aplicando: acá el blur reemplaza a ambos. */
.base-card {
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  transition:
    border-color var(--duration-base) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.base-card:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Elevacion en hover - solo escritorio con mouse/trackpad real (gateado
   ademas de min-width con hover:hover/pointer:fine) para no dejar un
   touchscreen "de escritorio" con el estado pegado tras el primer toque. En
   reposo la card se queda solo con borde (regla ya establecida de "nunca
   borde Y sombra marcada a la vez") - la sombra es una señal transitoria,
   nunca el look de reposo. */
@media (min-width: 1024px) and (hover: hover) and (pointer: fine) {
  .base-card:hover {
    transform: translateY(-4px);
    border-color: var(--glass-border-hover);
    box-shadow: var(--shadow-lg);
  }
}

.base-card.glass-strong {
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .base-card {
    background: var(--bg-surface);
  }
  .base-card.glass-strong {
    background: var(--bg-raised);
  }
}

.base-card.padded {
  padding: 1.5rem;
}

@media (max-width: 420px) {
  .base-card.padded {
    padding: 1.25rem;
  }
}
</style>
