<script setup lang="ts">
import { ref } from 'vue'
import type { Draft } from '../../services/transactions/interfaces/transactions.interface'
import { submitReceiptScan } from '../../services/receiptScanner/receipt-scanner.service'
import BottomSheet from '../ui/BottomSheet.vue'

// Boton de camara: dispara un <input type="file"> oculto
// (capture="environment" prioriza la camara trasera en movil, ver
// boundaries del plan - sin libreria externa). A diferencia del flujo de
// voz, aca no hay paso intermedio de confirmacion: apenas se elige/toma la
// foto se sube directo. El 503 "todavia no configurado" es el caso
// esperado hoy mismo en este entorno (proveedor de OCR sin key real), no un
// bug - se muestra el detail del backend tal cual.
const emit = defineEmits<{ created: [draft: Draft] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const errorMessage = ref('')
// Bottom sheet en vez de solo texto suelto - pedido explicito del usuario:
// misma pieza reutilizable que "nuevo movimiento" y voz. Se abre apenas se
// elige la foto (para que el progreso se vea en algun lado) y se cierra
// sola en exito; si falla, se queda abierto mostrando el error hasta que
// el usuario la cierre.
const showSheet = ref(false)

function triggerFilePicker() {
  errorMessage.value = ''
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  errorMessage.value = ''
  isUploading.value = true
  showSheet.value = true
  try {
    const draft = await submitReceiptScan(file)
    emit('created', draft)
    showSheet.value = false
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo escanear el recibo.'
  } finally {
    isUploading.value = false
    input.value = ''
  }
}

function closeSheet() {
  showSheet.value = false
  errorMessage.value = ''
}
</script>

<template>
  <div class="receipt-upload">
    <button
      type="button"
      class="capture-trigger"
      aria-label="Escanear recibo"
      :disabled="isUploading"
      @click="triggerFilePicker"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path
          d="M4 8V6a2 2 0 0 1 2-2h2l1.5-1.5h5L16 4h2a2 2 0 0 1 2 2v2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <circle cx="12" cy="14" r="3.25" />
      </svg>
    </button>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="visually-hidden"
      @change="onFileSelected"
    />

    <BottomSheet v-if="showSheet" title="Escanear recibo" @close="closeSheet">
      <p v-if="isUploading" class="upload-status">Escaneando recibo...</p>
      <p v-if="errorMessage" class="upload-error" role="alert">{{ errorMessage }}</p>
    </BottomSheet>
  </div>
</template>

<style scoped>
.receipt-upload {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
}

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

.capture-trigger:hover:not(:disabled) {
  opacity: 0.85;
}

.capture-trigger:active:not(:disabled) {
  transform: scale(0.94);
}

.capture-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.upload-status {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.upload-error {
  max-width: 12rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.75rem;
}
</style>
