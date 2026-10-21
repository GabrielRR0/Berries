import { ref } from 'vue'
import { useSpringBack } from './useSpringBack'

// Swipe-to-dismiss por Pointer Events + setPointerCapture (el move/up siguen
// llegando al mismo elemento aunque el dedo se mueva fuera de el). Solo se
// permite arrastrar hacia abajo. Pensado para paneles tipo BottomSheet.vue
// que se cierran emitiendo un evento al cruzar distancia o velocidad umbral,
// o vuelven a su lugar con fisica de resorte (useSpringBack) si se sueltan
// antes.
export function useSwipeToDismiss(onDismiss: () => void, options: { distance?: number; velocity?: number } = {}) {
  const DISMISS_DISTANCE = options.distance ?? 120 // px
  const DISMISS_VELOCITY = options.velocity ?? 0.5 // px/ms

  const isDragging = ref(false)
  const dragOffset = ref(0)
  let startY = 0
  let startTime = 0
  let activePointerId: number | null = null

  const { springBackTo } = useSpringBack(dragOffset)

  function onDragStart(event: PointerEvent) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    isDragging.value = true
    startY = event.clientY
    startTime = event.timeStamp
    dragOffset.value = 0
    activePointerId = event.pointerId
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  function onDragMove(event: PointerEvent) {
    if (!isDragging.value || event.pointerId !== activePointerId) return
    dragOffset.value = Math.max(0, event.clientY - startY)
  }

  async function onDragEnd(event: PointerEvent) {
    if (!isDragging.value || event.pointerId !== activePointerId) return
    const elapsed = event.timeStamp - startTime || 1
    const velocityPxMs = dragOffset.value / elapsed
    const shouldDismiss = dragOffset.value > DISMISS_DISTANCE || velocityPxMs > DISMISS_VELOCITY

    activePointerId = null

    if (shouldDismiss) {
      isDragging.value = false
      dragOffset.value = 0
      onDismiss()
      return
    }

    // No se solto: vuelve a su posicion de reposo con fisica de resorte real
    // (toma la velocidad del gesto, en px/s) en vez de saltar a 0 de golpe.
    // isDragging sigue en true mientras dura el resorte para que quien
    // consuma esto siga pisando la transform frame a frame con dragOffset.
    await springBackTo(0, velocityPxMs * 1000)
    isDragging.value = false
  }

  return { isDragging, dragOffset, onDragStart, onDragMove, onDragEnd }
}
