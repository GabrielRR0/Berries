<script setup lang="ts">
// Aviso compacto de "Pendientes por revisar" (borradores de voz, recibo o
// captura): en vez de apilar todas las tarjetas de revision arriba del
// historial, se muestra un contador y las tarjetas (slot) se despliegan al
// tocarlo. Estado y datos son de TransactionsMain.vue.
import { vPress } from '../../animation/vPress'
import { useCollapseTransition } from '../../animation/useCollapseTransition'

defineProps<{ count: number; expanded: boolean }>()
defineEmits<{ toggle: [] }>()
const { onEnter, onLeave } = useCollapseTransition()
</script>

<template>
  <!-- Entra animando su alto: al llegar los pendientes del servidor el resto de la
       pantalla se desliza hacia abajo en vez de dar un salto. -->
  <Transition :css="false" @enter="onEnter" @leave="onLeave">
  <div v-if="count > 0" class="drafts-banner">
    <button v-press="0.98" type="button" class="drafts-banner-button" :aria-expanded="expanded" @click="$emit('toggle')">
      <span class="drafts-banner-count">{{ count }}</span>
      <span class="drafts-banner-text">
        <span class="drafts-banner-title">Pendientes por revisar</span>
        <span class="drafts-banner-caption">Detectados desde voz, recibo o captura</span>
      </span>
      <svg class="drafts-banner-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <Transition :css="false" @enter="onEnter" @leave="onLeave">
      <div v-if="expanded" class="drafts-banner-list-wrap">
        <div class="drafts-banner-list"><slot /></div>
      </div>
    </Transition>
  </div>
  </Transition>
</template>

<style scoped src="./draftsBanner.css"></style>
