<script setup lang="ts">
// Circulo de icono reutilizable: grid de acciones rapidas (neutral), badges
// de Ingresos/Gastos (income/expense) y cualquier otro icono redondo de la
// UI. "expense" es el unico que usa el rojo de marca - "income" se queda en
// gris neutro a proposito (ver style.css: un solo acento, sin un segundo
// tono para "positivo").
withDefaults(defineProps<{ variant?: 'neutral' | 'income' | 'expense'; size?: 'sm' | 'md' | 'lg' }>(), {
  variant: 'neutral',
  size: 'md',
})
</script>

<template>
  <span class="icon-badge" :class="[variant, size]">
    <slot />
  </span>
</template>

<style scoped>
.icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  color: var(--text-h);
  /* Sin :active propio a proposito: quien lo envuelve en un boton (ej.
     QuickActionsGrid.vue) decide el press feedback via su propio
     ":active .icon-badge" - esta transition es lo que hace que se vea
     animado en vez de saltar de golpe. */
  transition:
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .icon-badge {
    background: var(--bg-raised);
  }
}

.icon-badge.sm {
  width: 2.25rem;
  height: 2.25rem;
}

.icon-badge.md {
  width: 2.75rem;
  height: 2.75rem;
}

.icon-badge.lg {
  width: 3.25rem;
  height: 3.25rem;
}

.icon-badge :deep(svg) {
  width: 46%;
  height: 46%;
}

.icon-badge.income {
  /* Mismo cristal neutro que .icon-badge base - "income" no lleva un
     segundo tono de color a proposito (ver comentario del script). */
  color: var(--text-h);
}

.icon-badge.expense {
  background: rgba(239, 68, 68, 0.16);
  border-color: var(--accent-border);
  color: var(--accent);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .icon-badge.expense {
    background: var(--accent-muted);
  }
}
</style>
