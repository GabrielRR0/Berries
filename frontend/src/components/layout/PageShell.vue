<script setup lang="ts">
// Wrapper de layout generico (contenido scrolleable, con aire reservado
// arriba/abajo para el header y la tab bar fijos) - deliberadamente libre de
// llamadas directas a window/document (solo props/slots/emits) para portar
// limpio a @ionic/vue mas adelante, segun pide la especificacion de Berry.
// Cualquier acceso al DOM nativo que haga falta en el futuro (ej. medir el
// viewport) va en un composable aparte, nunca aca.
//
// TopHeader/BottomTabBar YA NO se reciben por slot aca (antes #header/
// #bottom-nav): al ser position:fixed, cada pantalla montando su propia
// copia hacia que se superpusieran dos headers/tab-bars durante el swipe
// entre rutas. Ahora viven una sola vez en App.vue, fuera de esta pantalla -
// PageShell solo reserva el espacio para que el contenido no quede tapado.
withDefaults(defineProps<{ padded?: boolean }>(), { padded: true })
</script>

<template>
  <div class="page-shell">
    <main class="page-shell-content" :class="{ padded }">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  min-height: 100vh;
  background-color: var(--bg);
  background-image: var(--hero-glow);
  background-repeat: no-repeat;
}

.page-shell-content {
  flex: 1;
  min-width: 0;
}

.page-shell-content.padded {
  /* padding-top reserva el alto del header fijo (TopHeader.vue tambien es
     position:fixed, ver ese archivo) + aire; padding-bottom generoso deja
     lugar a la barra de tabs flotante fija (BottomTabBar.vue) sin que tape
     el final del contenido. */
  padding: calc(var(--header-height) + env(safe-area-inset-top) + 1rem) 1.25rem
    calc(6rem + env(safe-area-inset-bottom));
}
</style>
