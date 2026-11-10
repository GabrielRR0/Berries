<script setup lang="ts">
// Header superior: avatar circular a la izquierda, saludo ("Buenas tardes /
// Gabriel") y boton de ayuda a la derecha - sin saludo cae al wordmark
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
import HeaderAvatar from './HeaderAvatar.vue'

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
    <HeaderAvatar :initials="avatarInitials" @click="$emit('avatarClick')" />

    <div v-if="greeting" class="greeting">
      <span class="greeting-label">{{ greeting }}</span>
      <span v-if="name" class="greeting-name">{{ name }}</span>
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
