<script setup lang="ts">
import { useToast } from '../../composables/toast/useToast'

// Aviso flotante tipo notificacion de iPhone - pedido explicito del usuario:
// "que aparece arriba en el medio que desliza de arriba a abajo y despues
// cuando termina, suba". Vive una sola vez en App.vue (mismo criterio que
// BottomTabBar) para que cualquier pantalla pueda dispararlo via useToast().
const { active } = useToast()
</script>

<template>
  <div class="toast-viewport">
    <Transition name="toast-slide">
      <div v-if="active" :key="active.id" class="toast-banner" :class="`toast-banner--${active.tone}`" role="status">
        {{ active.text }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-viewport {
  position: fixed;
  top: max(0.75rem, env(safe-area-inset-top));
  left: 0;
  right: 0;
  z-index: 60;
  display: flex;
  justify-content: center;
  padding: 0 1rem;
  pointer-events: none;
}

.toast-banner {
  pointer-events: auto;
  max-width: 26rem;
  width: 100%;
  padding: 0.75rem 1.125rem;
  border-radius: 1rem;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  box-shadow: var(--shadow-md);
  color: var(--text-h);
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .toast-banner {
    background: var(--bg-raised);
  }
}

.toast-banner--error {
  border-color: var(--accent-border);
  color: var(--accent);
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition:
    transform var(--duration-base) var(--ease-out),
    opacity var(--duration-base) var(--ease-out);
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  transform: translateY(-140%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .toast-slide-enter-active,
  .toast-slide-leave-active {
    transition: opacity var(--duration-base) var(--ease-out);
  }

  .toast-slide-enter-from,
  .toast-slide-leave-to {
    transform: none;
  }
}
</style>
