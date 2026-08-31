<script setup lang="ts">
// Panel que sube desde abajo ("bottom sheet" tipo app movil - Instagram,
// iOS action sheets, etc.), pedido explicito del usuario para el detalle de
// Ingresos/Gastos de Inicio. Generico: cualquier pantalla puede usarlo con
// su propio titulo + contenido via slot. Cristal tipo Apple, igual criterio
// que el resto de los overlays de Berry (VoiceRecorderModal, etc.).
defineProps<{ title: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <!-- appear: quien usa este componente lo monta/desmonta entero con v-if
       (ver IncomeExpenseSummary.vue), asi que cada apertura es un mount
       nuevo de ESTE Transition - sin "appear" Vue trata eso como el render
       inicial y no anima nada (bug real: sin esto, la box aparecia sin
       transicion alguna). -->
  <Transition name="sheet" appear>
    <div class="sheet-scrim" @click.self="$emit('close')">
      <div class="sheet-panel">
        <span class="sheet-handle" aria-hidden="true" />

        <div class="sheet-header">
          <h2 class="sheet-title">{{ title }}</h2>
          <button type="button" class="sheet-close" aria-label="Cerrar" @click="$emit('close')">×</button>
        </div>

        <div class="sheet-body">
          <slot />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet-scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.sheet-panel {
  width: 100%;
  max-width: 30rem;
  max-height: min(80vh, 42rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1.5rem 1.5rem 0 0;
  border: 1px solid var(--glass-border);
  border-bottom: none;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sheet-panel {
    background: var(--bg-raised);
  }
}

.sheet-handle {
  flex-shrink: 0;
  width: 2.5rem;
  height: 0.25rem;
  margin: 0.75rem auto 0;
  border-radius: var(--radius-pill);
  background: var(--border);
}

.sheet-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
}

.sheet-title {
  font-size: 1.0625rem;
}

.sheet-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.sheet-close:hover {
  background: var(--bg-inset);
  color: var(--text-h);
}

.sheet-close:active {
  transform: scale(0.88);
}

.sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 1.25rem calc(1.5rem + env(safe-area-inset-bottom));
}

/* Fade del scrim + slide-up del panel a la vez - mismo patron que el modulo
   de transiciones de pagina (App.vue): un solo <Transition> en la raiz
   (.sheet-scrim), el panel hijo reacciona a las clases del padre via
   selector descendiente en vez de tener su propio <Transition> anidado. */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity var(--duration-base) var(--ease-slide);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform var(--duration-base) var(--ease-slide);
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}

/* Escritorio: el panel termina centrado en vez de pegado al borde inferior,
   pero la animacion sigue naciendo desde abajo (pedido explicito del
   usuario). Este bloque va al FINAL del <style> a proposito: tiene que
   ganarle en orden de cascada a ".sheet-enter-from .sheet-panel" de arriba
   (misma especificidad, dos selectores de clase) - si este bloque quedara
   antes, el translateY de escritorio quedaria pisado en silencio por la
   regla de mobile.
   El translateY NO puede seguir siendo un porcentaje: 100% funciona en
   mobile porque el panel ya esta pegado al borde inferior (align-items:
   flex-end) - trasladarlo el 100% de su propia altura lo manda fuera de la
   pantalla. Centrado, ese mismo 100% lo mandaria muy por debajo del
   viewport (un salto brusco, no una version mas chica del mismo
   movimiento) - por eso pasa a ser un valor fijo y chico. */
@media (min-width: 1024px) {
  .sheet-scrim {
    align-items: center;
  }

  .sheet-panel {
    max-width: 36rem;
    border-radius: 1.5rem;
    border-bottom: 1px solid var(--glass-border);
    box-shadow: var(--shadow-md);
  }

  /* La barrita de "deslizar" solo tiene sentido como affordance de swipe-to-
     dismiss pegado al borde de mobile - no hay gesto de swipe implementado
     en ningun breakpoint, y una vez que el panel flota centrado con backdrop
     en los 4 lados, esa convención deja de aplicar. */
  .sheet-handle {
    display: none;
  }

  .sheet-enter-from .sheet-panel,
  .sheet-leave-to .sheet-panel {
    transform: translateY(2rem);
  }
}
</style>
