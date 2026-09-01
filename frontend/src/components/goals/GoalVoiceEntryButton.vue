<script setup lang="ts">
import { ref } from 'vue'
import { previewGoalVoiceEntry } from '../../services/goals/goals.service'
import type { GoalVoicePreview } from '../../services/goals/interfaces/goals.interface'
import VoiceRecorderModal from '../voiceEntry/VoiceRecorderModal.vue'

// Espejo de VoiceEntryButton.vue (movimientos), pero apuntando al endpoint
// de preview de metas (sin persistencia - ver goal_voice_service.py) en vez
// de crear un TransactionDraft. VoiceRecorderModal.vue es el mismo
// componente compartido, genericizado via el prop "submit".
const emit = defineEmits<{ parsed: [preview: GoalVoicePreview] }>()

const showModal = ref(false)

function onCreated(result: unknown) {
  showModal.value = false
  emit('parsed', result as GoalVoicePreview)
}
</script>

<template>
  <button type="button" class="voice-trigger" aria-label="Crear meta por voz" @click="showModal = true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke-linecap="round" />
      <path d="M12 18v3M9 21h6" stroke-linecap="round" />
    </svg>
    <span>Crear por voz</span>
  </button>

  <VoiceRecorderModal
    v-if="showModal"
    :submit="previewGoalVoiceEntry"
    title="Crear meta por voz"
    example-hint='ej. "quiero comprar una MacBook en 4 meses, debo reunir 300 dólares cada mes"'
    @created="onCreated"
    @close="showModal = false"
  />
</template>

<style scoped>
.voice-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  color: var(--text-h);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .voice-trigger {
    background: var(--bg-raised);
  }
}

.voice-trigger svg {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
}

.voice-trigger:hover {
  opacity: 0.85;
}

.voice-trigger:active {
  transform: scale(0.97);
}
</style>
