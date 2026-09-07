import { ref } from 'vue'

// Aviso al usuario tipo notificacion de iPhone (pedido explicito: "una
// notificacion... que aparece arriba en el medio, desliza de arriba a abajo
// y despues sube") - pensado en primer lugar para el modo offline (avisar
// que algo quedo pendiente/se sincronizo), pero generico para cualquier
// pantalla. Singleton a nivel de modulo, mismo criterio que useOnlineStatus.ts -
// cualquier store/composable puede disparar un aviso sin que la pantalla
// activa tenga que montar nada especial (ToastBanner.vue vive una sola vez,
// en App.vue).
export type ToastTone = 'info' | 'success' | 'error'

export interface ToastMessage {
  id: string
  text: string
  tone: ToastTone
}

const DISPLAY_MS = 3200

const queue: ToastMessage[] = []
const active = ref<ToastMessage | null>(null)
let nextId = 0

// Uno a la vez (igual que un banner de iPhone) - si llegan varios avisos
// juntos (ej. varios items sincronizando en fila), se encolan y se muestran
// en orden en vez de superponerse.
function processQueue() {
  if (active.value || queue.length === 0) return
  active.value = queue.shift() ?? null
  setTimeout(() => {
    active.value = null
    processQueue()
  }, DISPLAY_MS)
}

function showToast(text: string, tone: ToastTone = 'info') {
  queue.push({ id: String(nextId++), text, tone })
  processQueue()
}

export function useToast() {
  return { active, showToast }
}
