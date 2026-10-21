<script setup lang="ts">
// Header superior: avatar circular a la izquierda, saludo ("Buenas tardes /
// Hola, Gabriel") y boton de ayuda a la derecha - sin saludo cae al wordmark
// de Berry centrado, como antes. Capturas de referencia "Rial" (esa
// referencia tenia ademas un boton de chat/soporte, quitado a pedido
// explicito del usuario: no hay ninguna funcionalidad de chat/soporte real
// detras). Igual que PageShell.vue, sin llamadas directas a
// window/document: toda interaccion sale por emits, listo para @ionic/vue -
// por eso "scrolled" llega como prop en vez de escuchar el scroll aca
// mismo (ver composables/layout/useScrollHeader.ts, usado desde App.vue).
// Arranca transparente sobre el contenido y solo se vuelve cristal/blur al
// scrollear hacia abajo - pedido explicito del usuario, igual que las apps
// nativas de telefono.
import BrandMark from '../ui/BrandMark.vue'

withDefaults(defineProps<{ avatarInitials?: string; scrolled?: boolean; greeting?: string; name?: string }>(), {
  avatarInitials: '',
  scrolled: false,
  greeting: '',
  name: '',
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

    <div v-if="greeting" class="greeting">
      <span class="greeting-label">{{ greeting }}</span>
      <span class="greeting-name">{{ name ? `Hola, ${name}` : 'Hola' }}</span>
    </div>
    <div v-else class="wordmark">
      <slot name="logo">
        <BrandMark size="1.75rem" />
      </slot>
    </div>

    <div class="header-actions">
      <button type="button" class="icon-button" aria-label="Ayuda" @click="$emit('helpClick')">?</button>
    </div>
  </header>
</template>

<style scoped src="./topHeader.css"></style>
