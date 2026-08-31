<script setup lang="ts">
// Header superior: avatar circular a la izquierda, wordmark centrado, boton
// de icono circular de ayuda a la derecha - ver capturas de referencia
// "Rial" (esa referencia tenia ademas un boton de chat/soporte, quitado a
// pedido explicito del usuario: no hay ninguna funcionalidad de chat/soporte
// real detras). Igual que PageShell.vue, sin llamadas directas a
// window/document: toda interaccion sale por emits, listo para @ionic/vue -
// por eso "scrolled" llega como prop en vez de escuchar el scroll aca
// mismo (ver composables/layout/useScrollHeader.ts, usado desde App.vue).
// Arranca transparente sobre el contenido y solo se vuelve cristal/blur al
// scrollear hacia abajo - pedido explicito del usuario, igual que las apps
// nativas de telefono.
import BrandMark from '../ui/BrandMark.vue'

withDefaults(defineProps<{ avatarInitials?: string; scrolled?: boolean }>(), {
  avatarInitials: '',
  scrolled: false,
})
defineEmits<{ avatarClick: []; helpClick: [] }>()
</script>

<template>
  <header class="top-header" :class="{ 'is-scrolled': scrolled }">
    <button type="button" class="avatar-button" aria-label="Perfil" @click="$emit('avatarClick')">
      <span v-if="avatarInitials">{{ avatarInitials }}</span>
      <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path
          d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.14 0-7.5 2.46-7.5 5.5V21h15v-1.5c0-3.04-3.36-5.5-7.5-5.5Z"
        />
      </svg>
    </button>

    <div class="wordmark">
      <slot name="logo">
        <BrandMark size="1.75rem" />
      </slot>
    </div>

    <div class="header-actions">
      <button type="button" class="icon-button" aria-label="Ayuda" @click="$emit('helpClick')">?</button>
    </div>
  </header>
</template>

<style scoped>
.top-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: var(--header-height);
  padding: calc(0.75rem + env(safe-area-inset-top)) 1.25rem 0.75rem;

  /* Transparente en reposo (arriba del todo) - el cristal tipo Apple (fondo
     traslucido + blur) solo aparece con .is-scrolled, cuando ya hay
     contenido real detras para desenfocar. Blur ya declarado desde el
     arranque (solo cambia backdrop-filter a "none", no el radio) para que
     backdrop-filter mismo pueda transicionar sin saltos en los motores que
     si lo animan. */
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

/* El header sigue siendo full-width (position:fixed; left:0; right:0) en
   escritorio, pero empuja avatar/wordmark/acciones hacia adentro para que
   se alineen con la columna de contenido centrada de abajo (max-width
   ~76rem en las pantallas de escritorio) en vez de quedar pegados a los
   bordes crudos del viewport - sin tocar el layout interno (sigue siendo
   el mismo flex avatar/wordmark/acciones). */
/* 72rem, no 76rem: tiene que coincidir con el max-width real de
   ".dashboard" (DashboardMain.vue, la unica pantalla que monta este header -
   ver App.vue). Con 76rem quedaba un desfasaje real de 32px entre el
   avatar/wordmark de arriba y el borde izquierdo de las cards de abajo. */
@media (min-width: 1024px) {
  .top-header {
    padding-inline: max(1.25rem, calc((100vw - 72rem) / 2));
  }
}

.top-header.is-scrolled {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border-bottom-color: var(--glass-border);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .top-header.is-scrolled {
    /* Fallback solido si el navegador no soporta backdrop-filter - sin esto
       el header quedaria semi-transparente sin desenfocar nada debajo. */
    background: var(--bg-surface);
  }
}

.avatar-button,
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
  /* Sombra sutil - pedido explicito del usuario tras comparar con la
     referencia "Rial": sin esto los circulos se veian planos/pegados al
     fondo, sobre todo con el header transparente (arriba del todo, antes
     de scrollear). Le da la sensacion de que "flotan" sobre el contenido. */
  box-shadow: var(--shadow-md);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.avatar-button svg,
.icon-button svg {
  width: 1.125rem;
  height: 1.125rem;
}

.avatar-button:hover,
.icon-button:hover {
  opacity: 0.85;
}

.avatar-button:active,
.icon-button:active {
  transform: scale(0.9);
}

.wordmark {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4375rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
