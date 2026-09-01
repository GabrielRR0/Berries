<script setup lang="ts">
import { ref } from 'vue'
import { parseDebtPaymentVoice } from '../../services/debts/debts.service'
import type { DebtPaymentVoicePreview } from '../../services/debts/interfaces/debts.interface'
import VoiceRecorderModal from '../voiceEntry/VoiceRecorderModal.vue'

// Espejo de GoalVoiceEntryButton.vue (metas): mismo VoiceRecorderModal.vue
// generico, apuntando al endpoint de parseo de pagos de deuda (sin
// persistencia - ver payment_voice_parser.py) en vez de crear nada. El
// resultado solo precarga AddDebtPaymentForm.vue, el usuario siempre
// confirma antes de que se registre de verdad - pedido explicito del
// usuario: reconocer "hoy"/"ayer"/"hace 3 dias" y el monto/moneda dichos,
// no crear el pago directo desde la voz.
const props = defineProps<{ debtId: string }>()
const emit = defineEmits<{ parsed: [preview: DebtPaymentVoicePreview] }>()

const showModal = ref(false)

function submit(transcript: string) {
  return parseDebtPaymentVoice(props.debtId, transcript)
}

function onCreated(result: unknown) {
  showModal.value = false
  emit('parsed', result as DebtPaymentVoicePreview)
}
</script>

<template>
  <button type="button" class="voice-trigger" aria-label="Registrar pago por voz" @click="showModal = true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke-linecap="round" />
      <path d="M12 18v3M9 21h6" stroke-linecap="round" />
    </svg>
    <span>Registrar por voz</span>
  </button>

  <VoiceRecorderModal
    v-if="showModal"
    :submit="submit"
    title="Registrar pago por voz"
    example-hint='ej. "ayer me pagaron 50 dólares"'
    @created="onCreated"
    @close="showModal = false"
  />
</template>

<style scoped>
.voice-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
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
