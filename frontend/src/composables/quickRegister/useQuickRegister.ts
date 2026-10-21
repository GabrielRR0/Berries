import { ref, shallowRef } from 'vue'

// Estado compartido del panel "Registrar" (QuickRegisterHost.vue): lo abre el
// boton "+" de la barra flotante y los accesos rapidos de Inicio, sin
// navegar a ninguna pantalla. A nivel de MODULO (no dentro de un componente)
// porque quien lo dispara y quien lo muestra no tienen relacion padre/hijo -
// mismo criterio que useOnboardingTour.ts.
export type QuickRegisterStep = 'menu' | 'form' | 'drafts'

const isOpen = ref(false)
const step = ref<QuickRegisterStep>('menu')
// Rect del boton del que "nace" el panel, para la animacion de expansion
// (ver animation/morphFromOrigin.ts). null = sin origen conocido.
const origin = shallowRef<DOMRect | null>(null)
// Contador (no booleano) para poder pedir el grabador varias veces seguidas.
const voiceRequests = ref(0)
// Cuanto bajo el panel (px) cuando se cerro arrastrandolo: la animacion de
// cierre parte de ahi (ver animation/morphFromOrigin.ts).
const closeOffsetY = ref(0)
let receiptPicker: (() => void) | null = null

export function useQuickRegister() {
  function open(from?: Element | null) {
    origin.value = from?.getBoundingClientRect() ?? null
    step.value = 'menu'
    isOpen.value = true
  }

  // Panel de revision de borradores (creados por voz o recibo): sin origen,
  // porque ya no hay un boton del que expandirse.
  function showDrafts() {
    origin.value = null
    step.value = 'drafts'
    isOpen.value = true
  }

  function close(fromOffsetY = 0) {
    closeOffsetY.value = fromOffsetY
    isOpen.value = false
  }

  function requestVoice() {
    voiceRequests.value += 1
  }

  // El selector de archivos solo abre dentro del gesto del usuario: por eso
  // el host registra su funcion aca y se llama de forma SINCRONA desde el
  // click, sin pasar por ningun await/watch.
  function requestReceipt() {
    receiptPicker?.()
  }

  function registerReceiptPicker(picker: () => void): () => void {
    receiptPicker = picker
    return () => {
      if (receiptPicker === picker) receiptPicker = null
    }
  }

  return {
    isOpen,
    step,
    origin,
    voiceRequests,
    closeOffsetY,
    open,
    showDrafts,
    close,
    requestVoice,
    requestReceipt,
    registerReceiptPicker,
  }
}
