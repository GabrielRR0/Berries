<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSwipeToDismiss } from '../../animation/useSwipeToDismiss'
import { useQuickRegister } from '../../composables/quickRegister/useQuickRegister'
import { useQuickRegisterFlow } from '../../composables/quickRegister/useQuickRegisterFlow'
import { useQuickRegisterPresentation } from '../../composables/quickRegister/useQuickRegisterPresentation'
import { submitVoiceEntry } from '../../services/voiceEntry/voice-entry.service'
import ReceiptUpload from '../receiptScanner/ReceiptUpload.vue'
import DraftReviewCard from '../transactions/DraftReviewCard.vue'
import TransactionForm from '../transactions/TransactionForm.vue'
import VoiceRecorderModal from '../voiceEntry/VoiceRecorderModal.vue'
import QuickRegisterMenu from './QuickRegisterMenu.vue'

// Panel "Registrar" global (montado una sola vez en App.vue, igual que
// BottomTabBar): se abre desde el "+" de la barra flotante o desde los
// accesos de Inicio, naciendo del boton que lo abrio (ver
// animation/morphFromOrigin.ts) y SIN llevar al usuario a Movimientos.
// Pregunta primero como registrar - escribir, voz, recibo o capturas - y
// sigue en el mismo panel hasta guardar. Esta componente solo conecta: el
// estado vive en useQuickRegister.ts, el ciclo visual en
// useQuickRegisterPresentation.ts y lo que pasa al guardar en
// useQuickRegisterFlow.ts.
const router = useRouter()
const quickRegister = useQuickRegister()
const { isOpen, step, voiceRequests, close } = quickRegister
const flow = useQuickRegisterFlow()

const panelRef = ref<HTMLElement | null>(null)
const { rendered } = useQuickRegisterPresentation(panelRef)

// Arrastrar hacia abajo desde el asa o el titulo cierra el panel (mismo gesto
// que BottomSheet.vue, ver animation/useSwipeToDismiss.ts). Al soltar, el
// cierre arranca desde donde quedo el dedo: se recuerda el ultimo
// desplazamiento porque el composable lo reinicia a 0 justo antes de avisar.
let lastDragOffset = 0
const { isDragging, dragOffset, onDragStart, onDragMove, onDragEnd } = useSwipeToDismiss(() => close(lastDragOffset))
watch(dragOffset, (offset) => {
  if (offset > 0) lastDragOffset = offset
})

// Instancia del escaner de recibos sin su boton (solo se usa su selector de
// archivos y su sheet de progreso) y grabador de voz: viven aca, siempre
// montados, para que los accesos de Inicio puedan dispararlos sin abrir el
// panel.
const receipt = ref<InstanceType<typeof ReceiptUpload> | null>(null)
const showVoice = ref(false)

let unregisterReceiptPicker: (() => void) | null = null
onMounted(() => {
  unregisterReceiptPicker = quickRegister.registerReceiptPicker(() => receipt.value?.open())
})
onBeforeUnmount(() => unregisterReceiptPicker?.())

watch(voiceRequests, () => {
  flow.ensureWallets()
  showVoice.value = true
})
watch(isOpen, (open) => {
  if (open) flow.ensureWallets()
})

function onVoiceCreated(result: unknown) {
  showVoice.value = false
  flow.onDraftCreated(result as Parameters<typeof flow.onDraftCreated>[0])
}

function goToCaptures() {
  close()
  router.push({ name: 'movimientos-captura' })
}
</script>

<template>
  <div class="register-host">
    <ReceiptUpload ref="receipt" hide-trigger @created="flow.onDraftCreated" />

    <VoiceRecorderModal
      v-if="showVoice"
      :submit="submitVoiceEntry"
      @created="onVoiceCreated"
      @close="showVoice = false"
    />

    <div v-if="rendered" class="register-scrim" :class="{ 'is-closing': !isOpen }" @click="close()" />

    <section
      v-if="rendered"
      ref="panelRef"
      class="register-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar movimiento"
      :class="{ 'is-dragging': isDragging }"
      :style="isDragging ? { transform: `translateY(${dragOffset}px)` } : undefined"
    >
      <div data-morph-content>
        <!-- Zona de arrastre: el asa y el titulo juntos (el asa sola mide 4px y
             es muy dificil de agarrar con el dedo). Los botones frenan el
             pointerdown para no iniciar un arrastre al tocarlos. -->
        <div
          class="register-drag-zone"
          @pointerdown="onDragStart"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        >
        <span class="register-grab" aria-hidden="true" />

        <header class="register-header">
          <button
            v-if="step === 'form'"
            type="button"
            class="register-icon-button"
            aria-label="Volver"
            @pointerdown.stop
            @click="step = 'menu'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M15 5 8 12l7 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <h2 class="register-title">
            <template v-if="step === 'menu'">¿Cómo quieres registrarlo?</template>
            <template v-else-if="step === 'form'">Escribir movimiento</template>
            <template v-else>Revisa y confirma</template>
          </h2>
          <button type="button" class="register-icon-button" aria-label="Cerrar" @pointerdown.stop @click="close()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
            </svg>
          </button>
        </header>
        </div>

        <QuickRegisterMenu
          v-if="step === 'menu'"
          @write="step = 'form'"
          @voice="quickRegister.requestVoice()"
          @receipt="quickRegister.requestReceipt()"
          @captures="goToCaptures"
        />

        <TransactionForm
          v-else-if="step === 'form'"
          @created="flow.onTransactionCreated"
          @queued="flow.onTransactionQueued"
          @cancel="step = 'menu'"
        />

        <div v-else class="register-drafts">
          <DraftReviewCard
            v-for="draft in flow.drafts.value"
            :key="draft.id"
            :draft="draft"
            @confirmed="flow.onDraftConfirmed"
            @discarded="flow.onDraftDiscarded"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped src="./quickRegisterHost.css"></style>
