<script setup lang="ts">
import { ref } from 'vue'
import type { Draft } from '../../services/transactions/interfaces/transactions.interface'
import { submitVoiceEntry } from '../../services/voiceEntry/voice-entry.service'
import VoiceRecorderModal from './VoiceRecorderModal.vue'

// Boton chico (icono de microfono) que abre VoiceRecorderModal.vue - el
// flujo real de grabacion/envio vive ahi, este componente solo controla la
// visibilidad del modal y reenvia el draft creado hacia quien lo use
// (TransactionsMain.vue). VoiceRecorderModal.vue ahora es generico (recibe
// "submit" por prop, ver ese archivo) para poder reusarse tambien en Metas
// (GoalVoiceEntryButton.vue) sin duplicar la maquinaria de grabacion.
const emit = defineEmits<{ created: [draft: Draft] }>()

const showModal = ref(false)

function onCreated(result: unknown) {
  showModal.value = false
  emit('created', result as Draft)
}
</script>

<template>
  <button type="button" class="capture-trigger" aria-label="Registrar movimiento por voz" @click="showModal = true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke-linecap="round" />
      <path d="M12 18v3M9 21h6" stroke-linecap="round" />
    </svg>
  </button>

  <VoiceRecorderModal v-if="showModal" :submit="submitVoiceEntry" @created="onCreated" @close="showModal = false" />
</template>

<style scoped>
.capture-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  color: var(--text-h);
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .capture-trigger {
    background: var(--bg-raised);
  }
}

.capture-trigger svg {
  width: 1.125rem;
  height: 1.125rem;
}

.capture-trigger:hover {
  opacity: 0.85;
}

.capture-trigger:active {
  transform: scale(0.94);
}
</style>
