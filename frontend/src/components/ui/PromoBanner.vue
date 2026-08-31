<script setup lang="ts">
// Banner promocional descartable (icono + titulo + subtitulo + cerrar) -
// ver capturas de referencia "Rial". Tonto y controlado: quien lo usa
// decide si sigue montado tras el "dismiss" (ver DashboardMain.vue, que
// guarda el estado de descarte con un ref local).
defineProps<{ title: string; subtitle: string }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="promo-banner">
    <span class="promo-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path
          d="M12 2 3 7v6c0 5 4 8.5 9 9 5-.5 9-4 9-9V7l-9-5Z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M9 12.5 11 14.5 15 9.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <div class="promo-copy">
      <p class="promo-title">{{ title }}</p>
      <p class="promo-subtitle">{{ subtitle }}</p>
    </div>
    <button type="button" class="promo-close" aria-label="Cerrar" @click="$emit('dismiss')">×</button>
  </div>
</template>

<style scoped>
.promo-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  /* Mas presencia que antes - pedido explicito del usuario tras comparar
     con la referencia "Rial": ese banner tiene mas alto/aire, lo cual lo
     hace destacar mejor como el llamado a la accion promocional que es. */
  padding: 1.25rem 1.25rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .promo-banner {
    background: var(--bg-surface);
  }
}

.promo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-pill);
  background: rgba(239, 68, 68, 0.16);
  color: var(--accent);
}

.promo-icon svg {
  width: 55%;
  height: 55%;
}

.promo-copy {
  flex: 1;
  min-width: 0;
}

.promo-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-h);
}

.promo-subtitle {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--text-muted);
}

.promo-close {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--bg-inset);
  color: var(--text-muted);
  font-size: 1.125rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.promo-close:active {
  transform: scale(0.88);
}

.promo-close:hover {
  color: var(--text-h);
}
</style>
