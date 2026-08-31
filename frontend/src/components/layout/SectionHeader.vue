<script setup lang="ts">
// Header reutilizable para pantallas secundarias (Movimientos, Cuentas, ...) -
// volver+titulo a la izquierda+"?" a la derecha, a diferencia de TopHeader.vue
// (Inicio, wordmark centrado). Generalizado a partir del primer uso
// (MovimientosHeader.vue) porque Cuentas pidio explicitamente el mismo estilo -
// pedido explicito del usuario ("el estilo que se hizo en movimientos debe
// ser lo mismo para la seccion cuentas"). Mismo criterio de
// cristal-al-scrollear (useScrollHeader.ts) que TopHeader.vue, pero
// self-contained: no depende de App.vue, y su "?" abre una explicacion propia
// de la pantalla que lo use, no el tour de Inicio.
import { useScrollHeader } from '../../composables/layout/useScrollHeader'

// maxWidth: tiene que coincidir con el max-width real del contenido de
// escritorio de quien use este header (cada *Main.vue define el suyo:
// TransactionsMain 76rem, WalletsMain 64rem, DebtsMain 68rem) - sin esto, el
// padding-inline de escritorio (mas abajo) quedaba fijo en un solo valor
// (76rem) y desalineaba el header con las cards de abajo en cualquier
// pantalla que no usara justo ese ancho.
withDefaults(defineProps<{ title: string; maxWidth?: string }>(), { maxWidth: '76rem' })
defineEmits<{ back: []; help: [] }>()

const { isScrolled } = useScrollHeader()
</script>

<template>
  <header
    class="section-header"
    :class="{ 'is-scrolled': isScrolled }"
    :style="{ '--section-header-max-width': maxWidth }"
  >
    <button type="button" class="icon-button" aria-label="Volver" @click="$emit('back')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 5 8 12l7 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <h1 class="section-header-title">{{ title }}</h1>

    <button type="button" class="icon-button" aria-label="¿Qué es esta sección?" @click="$emit('help')">?</button>
  </header>
</template>

<style scoped>
.section-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: var(--header-height);
  padding: calc(0.75rem + env(safe-area-inset-top)) 1.25rem 0.75rem;
  background: transparent;
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  border-bottom: 1px solid transparent;
  transition:
    background-color var(--duration-base) var(--ease-out),
    border-color var(--duration-base) var(--ease-out),
    backdrop-filter var(--duration-base) var(--ease-out),
    -webkit-backdrop-filter var(--duration-base) var(--ease-out);
}

/* Header full-width en escritorio tambien, pero empuja volver/titulo/ayuda
   hacia adentro para que se alineen con la columna de contenido centrada
   de abajo (mismo criterio y mismo ancho de referencia que TopHeader.vue). */
@media (min-width: 1024px) {
  .section-header {
    padding-inline: max(1.25rem, calc((100vw - var(--section-header-max-width)) / 2));
  }

  /* Hoy es el titulo mas chico de toda la app (1.0625rem) sin ningun ajuste
     de escritorio propio, pese a ser el "titulo de pantalla" de Movimientos/
     Cuentas/Deudas. */
  .section-header-title {
    font-size: 1.5rem;
  }
}

.section-header.is-scrolled {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border-bottom-color: var(--glass-border);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .section-header.is-scrolled {
    background: var(--bg-surface);
  }
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-strong);
  color: var(--text-h);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  box-shadow: var(--shadow-md);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.icon-button svg {
  width: 1.125rem;
  height: 1.125rem;
}

.icon-button:hover {
  opacity: 0.85;
}

.icon-button:active {
  transform: scale(0.9);
}

.section-header-title {
  flex: 1;
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-h);
}
</style>
