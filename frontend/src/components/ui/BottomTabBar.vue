<script setup lang="ts">
import { useRoute } from 'vue-router'

// Barra flotante fija - 3 tabs alcanzan por ahora (Inicio/Movimientos/Menu),
// segun el layout de referencia. "Menu" apunta a /ajustes hasta que exista
// una pantalla de menu propia (ver router/index.ts).
const tabs = [
  { name: 'dashboard', to: '/', label: 'Inicio' },
  { name: 'movimientos', to: '/movimientos', label: 'Movimientos' },
  { name: 'ajustes', to: '/ajustes', label: 'Menú' },
] as const

const route = useRoute()
</script>

<template>
  <nav class="bottom-tab-bar" aria-label="Navegación principal">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.name"
      :to="tab.to"
      class="tab"
      :class="{ active: route.name === tab.name }"
    >
      <span class="tab-icon" aria-hidden="true">
        <svg v-if="tab.name === 'dashboard'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 11.5 12 4l9 7.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M5.5 10v9a1 1 0 0 0 1 1H9.5a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-9" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else-if="tab.name === 'movimientos'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7h13M17 7l-3-3M17 7l-3 3" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M20 17H7M7 17l3 3M7 17l3-3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
        </svg>
      </span>
      <span class="tab-label">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottom-tab-bar {
  position: fixed;
  left: 50%;
  bottom: max(1.25rem, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  /* Cristal tipo Apple: el contenido scrolleable pasa por debajo de esta
     barra flotante, asi que el blur tiene algo real para desenfocar. */
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  box-shadow: var(--shadow-md);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .bottom-tab-bar {
    background: var(--bg-raised);
  }
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  min-width: 4.25rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-pill);
  text-decoration: none;
  color: var(--text-muted);
  transition:
    color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

.tab-icon {
  display: inline-flex;
  width: 1.375rem;
  height: 1.375rem;
}

.tab-icon svg {
  width: 100%;
  height: 100%;
}

.tab-label {
  font-size: 0.6875rem;
  font-weight: 600;
}

.tab.active {
  color: var(--accent);
}

/* En escritorio se queda flotante/centrada igual (pedido explicito del
   usuario: nada de sidebar) - se probo agrandarla un poco (min-width mayor,
   mas padding horizontal) y seguia viendose "muy grande"; se queda
   exactamente del mismo tamaño que en mobile, un dock real (macOS, apps
   desktop-class) tampoco escala con el tamaño de pantalla. Unico agregado
   real de escritorio: el hover. */
@media (min-width: 1024px) {
  .tab:hover {
    background: var(--bg-inset);
  }

  /* Calificado con :not(.active): un .tab:hover sin calificar tiene la
     misma especificidad que .tab.active (2 clases cada uno) y podria pisar
     el rojo del tab activo al pasar el mouse, segun el orden final del CSS
     compilado. */
  .tab:not(.active):hover {
    color: var(--text);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .tab:active {
    transform: scale(0.9);
    opacity: 0.75;
  }
}
</style>
