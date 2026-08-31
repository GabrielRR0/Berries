<script setup lang="ts">
// Tooltip tipo "coach mark" de onboarding (ver capturas de referencia
// "Rial"): una tarjeta chica con flecha que senala un control puntual,
// descartable. Puramente controlado por props/emits - quien lo usa decide
// cuando mostrarlo y donde queda posicionado (via CSS del padre).
// stepLabel (ej. "1/6"): cuando viene, este coach-mark es un paso del tour
// guiado de Inicio (ver useOnboardingTour.ts) y muestra la fila de
// Atrás/Continuar; sin stepLabel se comporta como antes (solo el "×").
const props = withDefaults(
  defineProps<{
    visible?: boolean
    title: string
    text: string
    stepLabel?: string
    showBack?: boolean
    nextLabel?: string
    /** Posicion horizontal de la flechita (CSS length) - por default apunta
     * un poco a la derecha del borde izquierdo; algun caller puntual (ej.
     * BalanceCard.vue, para señalar el boton del ojo especificamente) la
     * corre mas para que apunte mejor a su control real. */
    arrowOffset?: string
  }>(),
  { visible: true, showBack: false, nextLabel: 'Continuar', arrowOffset: '1.25rem' },
)
defineEmits<{ dismiss: []; back: []; next: [] }>()
</script>

<template>
  <Transition name="coach-mark-fade">
    <div v-if="visible" class="coach-mark" role="status">
      <div class="coach-mark-arrow" :style="{ left: props.arrowOffset }" aria-hidden="true" />
      <div class="coach-mark-body">
        <div class="coach-mark-head">
          <p class="coach-mark-title">{{ title }}</p>
          <span v-if="stepLabel" class="coach-mark-step">{{ stepLabel }}</span>
        </div>
        <p class="coach-mark-text">{{ text }}</p>
        <div v-if="stepLabel" class="coach-mark-nav">
          <button v-if="showBack" type="button" class="coach-mark-nav-button secondary" @click="$emit('back')">
            Atrás
          </button>
          <button type="button" class="coach-mark-nav-button primary" @click="$emit('next')">
            {{ nextLabel }}
          </button>
        </div>
      </div>
      <button type="button" class="coach-mark-close" aria-label="Cerrar" @click="$emit('dismiss')">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.coach-mark {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  /* width explicito, no solo max-width: al ser position:absolute dentro de
     un padre que se achica a su contenido (.balance-header), el shrink-to-fit
     por defecto lo dejaba con casi nada de ancho disponible y el texto
     terminaba envuelto en una columna angosta de una palabra por linea. */
  width: 15rem;
  max-width: calc(100vw - 2.5rem);
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  /* Cristal tipo Apple, igual criterio que el header/tab bar fijos. */
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-md);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .coach-mark {
    background: var(--bg-raised);
  }
}

.coach-mark-arrow {
  position: absolute;
  top: -0.375rem;
  width: 0.75rem;
  height: 0.75rem;
  background: var(--glass-bg-strong);
  border-left: 1px solid var(--glass-border);
  border-top: 1px solid var(--glass-border);
  transform: rotate(45deg);
}

.coach-mark-body {
  flex: 1;
  min-width: 0;
}

.coach-mark-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.coach-mark-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-h);
}

.coach-mark-step {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
}

.coach-mark-text {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.coach-mark-nav {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.625rem;
}

.coach-mark-nav-button {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-pill);
  border: none;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.coach-mark-nav-button.secondary {
  background: var(--glass-bg);
  color: var(--text-h);
  border: 1px solid var(--glass-border);
}

.coach-mark-nav-button.primary {
  background: var(--accent);
  color: var(--accent-contrast);
}

.coach-mark-nav-button:hover {
  opacity: 0.88;
}

.coach-mark-nav-button:active {
  transform: scale(0.94);
  opacity: 0.8;
}

.coach-mark-close {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.coach-mark-close:hover {
  background: var(--bg-inset);
  color: var(--text-h);
}

.coach-mark-close:active {
  transform: scale(0.88);
}

.coach-mark-fade-enter-active,
.coach-mark-fade-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.coach-mark-fade-enter-from,
.coach-mark-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
