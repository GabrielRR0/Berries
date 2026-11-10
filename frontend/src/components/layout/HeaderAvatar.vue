<script setup lang="ts">
// Circulo de perfil del header (ver TopHeader.vue). Solo conecta: iniciales o un icono
// de persona; la forma y los colores (que siguen el acento del tema) viven en
// headerAvatar.css.
defineProps<{ initials?: string }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button type="button" class="header-avatar" aria-label="Perfil" @click="$emit('click')">
    <span v-if="initials" class="header-avatar-initials">{{ initials }}</span>
    <svg v-else class="header-avatar-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.14 0-7.5 2.46-7.5 5.5V21h15v-1.5c0-3.04-3.36-5.5-7.5-5.5Z"
      />
    </svg>
  </button>
</template>

<style scoped src="./headerAvatar.css"></style>
