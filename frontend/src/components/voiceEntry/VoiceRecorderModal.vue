<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import BaseButton from '../ui/BaseButton.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import type { BerrySpeechRecognition } from '../../types/speech-recognition'

// Modal de registro por voz - la transcripción ocurre DENTRO del navegador vía la Web
// Speech API (SpeechRecognition), no se graba ni se sube ningún archivo de audio.
// Generico (props "submit"/"title"/"exampleHint") para poder reusarse tanto en
// Movimientos (submitVoiceEntry, crea un TransactionDraft) como en Metas
// (previewGoalVoiceEntry, solo parsea, ver GoalVoiceEntryButton.vue) sin duplicar toda
// la maquinaria de grabacion/estado - "submit" resuelve a lo que sea que el resultado
// final termine siendo (Draft para movimientos, GoalVoicePreview para metas), este
// componente no necesita saber la forma exacta.
// Fases:
//   unsupported (el navegador no tiene SpeechRecognition, ver `recognitionCtor` abajo)
//   idle (explica qué va a pasar ANTES de disparar el prompt nativo de permiso del
//     micrófono, para que no aparezca de sorpresa - "pedir permiso de forma intuitiva")
//   listening (reconociendo, muestra el transcript parcial en vivo)
//   reviewing (transcript final, editable, con Enviar/Grabar de nuevo)
//   submitting (enviando el transcript ya confirmado al backend)
const props = withDefaults(
  defineProps<{
    submit: (transcript: string) => Promise<unknown>
    title?: string
    exampleHint?: string
  }>(),
  {
    title: 'Registrar por voz',
    exampleHint: 'ej. "gasté 20 dólares en comida"',
  },
)

const emit = defineEmits<{ created: [result: unknown]; close: [] }>()

type Phase = 'unsupported' | 'idle' | 'listening' | 'reviewing' | 'submitting'

const recognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition
const recognitionLang = import.meta.env.VITE_VOICE_RECOGNITION_LANG || 'es-419'

const phase = ref<Phase>(recognitionCtor ? 'idle' : 'unsupported')
const errorMessage = ref('')
const liveTranscript = ref('')
const transcript = ref('')

let recognition: BerrySpeechRecognition | null = null

function mapSpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'permission-denied':
      return 'No se pudo acceder al micrófono. Revisa los permisos del navegador.'
    case 'no-speech':
      return 'No se detectó voz. Intenta de nuevo, más cerca del micrófono.'
    case 'network':
      return 'Error de red durante el reconocimiento de voz. Intenta de nuevo.'
    default:
      return 'No se pudo reconocer el audio. Intenta de nuevo.'
  }
}

function stopRecognition() {
  recognition?.stop()
  recognition = null
}

function startListening() {
  if (!recognitionCtor) return

  errorMessage.value = ''
  liveTranscript.value = ''
  let finalTranscript = ''

  const recognizer = new recognitionCtor()
  recognizer.lang = recognitionLang
  recognizer.interimResults = true
  recognizer.maxAlternatives = 1
  recognizer.continuous = false

  recognizer.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) {
        finalTranscript += result[0].transcript
      } else {
        interim += result[0].transcript
      }
    }
    liveTranscript.value = finalTranscript || interim
  }

  recognizer.onerror = (event) => {
    phase.value = 'idle'
    errorMessage.value = mapSpeechError(event.error)
  }

  recognizer.onend = () => {
    const finalText = finalTranscript.trim()
    if (finalText) {
      transcript.value = finalText
      phase.value = 'reviewing'
    } else if (phase.value === 'listening') {
      phase.value = 'idle'
      errorMessage.value = 'No se detectó voz. Intenta de nuevo.'
    }
  }

  recognition = recognizer
  recognizer.start()
  phase.value = 'listening'
}

function stopListening() {
  stopRecognition()
}

async function onSubmit() {
  if (!transcript.value.trim()) return

  errorMessage.value = ''
  phase.value = 'submitting'
  try {
    const result = await props.submit(transcript.value.trim())
    emit('created', result)
  } catch (error) {
    // Vuelve a "reviewing" (no a "idle"): el transcript sigue disponible y el
    // usuario puede reintentar "Enviar" sin dictar de nuevo.
    phase.value = 'reviewing'
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo enviar.'
  }
}

function onRetry() {
  transcript.value = ''
  liveTranscript.value = ''
  errorMessage.value = ''
  phase.value = 'idle'
}

function onClose() {
  stopRecognition()
  emit('close')
}

onUnmounted(() => {
  stopRecognition()
})
</script>

<template>
  <!-- Bottom sheet en vez de modal centrado - pedido explicito del usuario:
       misma pieza reutilizable (BottomSheet.vue) que ya usa el detalle de
       Ingresos/Gastos de Inicio, para que "nuevo movimiento", voz y foto se
       sientan como una sola familia de interacciones en toda la app. -->
  <BottomSheet :title="title" @close="onClose">
    <p v-if="phase === 'unsupported'" class="modal-hint">
      Tu navegador no soporta dictado por voz. Prueba con Chrome o Edge, o cargalo manualmente.
    </p>

    <template v-else>
      <p v-if="phase === 'idle'" class="modal-hint">
        Vamos a pedirte acceso al micrófono para transcribir lo que digas ({{ exampleHint }}). Nada se graba ni se
        guarda como audio — el navegador lo convierte directo a texto.
      </p>

      <div v-if="phase === 'listening'" class="recorder-status">
        <span class="recording-indicator" aria-hidden="true" />
        <span class="recorder-live">{{ liveTranscript || 'Escuchando...' }}</span>
      </div>

      <label v-if="phase === 'reviewing' || phase === 'submitting'" class="transcript-field">
        <span class="field-label">Texto reconocido (puedes corregirlo)</span>
        <textarea v-model="transcript" rows="3" :disabled="phase === 'submitting'" />
      </label>
    </template>

    <p v-if="errorMessage" class="modal-error" role="alert">{{ errorMessage }}</p>

    <div class="modal-actions">
      <BaseButton v-if="phase === 'idle'" type="button" size="sm" @click="startListening">
        Empezar a hablar
      </BaseButton>

      <BaseButton v-if="phase === 'listening'" type="button" variant="secondary" size="sm" @click="stopListening">
        Detener
      </BaseButton>

      <template v-if="phase === 'reviewing'">
        <BaseButton type="button" variant="secondary" size="sm" @click="onRetry">Dictar de nuevo</BaseButton>
        <BaseButton type="button" size="sm" @click="onSubmit">Enviar</BaseButton>
      </template>

      <BaseButton v-if="phase === 'submitting'" type="button" size="sm" disabled>Enviando...</BaseButton>
    </div>
  </BottomSheet>
</template>

<style scoped>
.modal-hint {
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.recorder-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.recording-indicator {
  flex-shrink: 0;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: var(--radius-pill);
  background: var(--accent);
  animation: pulse 1.2s var(--ease-out) infinite;
}

.recorder-live {
  font-size: 0.875rem;
  color: var(--text-h);
}

.transcript-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.transcript-field textarea {
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  /* 1rem, no menos: por debajo de 16px iOS Safari hace zoom automatico al
     enfocar - rompe la sensacion de app nativa. */
  font-size: 1rem;
  resize: vertical;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.transcript-field textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.modal-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(1.3);
  }
}
</style>
