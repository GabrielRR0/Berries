import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import type { SectionPager } from './useSectionPager'
import { createVelocityTracker } from './velocityTracker'

// Deteccion del gesto horizontal entre secciones - solo decide QUE hizo el
// dedo; donde termina cada pagina lo decide useSectionPager.ts. Pointer
// Events nativos (libreria de gestos vetada en DESIGN.md), solo touch/pen: un
// mouse nunca arrastra paginas.
const EDGE_IGNORE_PX = 24 // No robarle al SO el gesto de "volver" desde el borde.
// Movimiento minimo antes de decidir horizontal vs vertical. No subirlo: el
// navegador empieza su propio scroll a partir de ~8px, y la decision tiene
// que estar tomada antes (si no, llega un pointercancel y el arrastre muere).
const CLAIM_THRESHOLD_PX = 8
// Cuenta como horizontal si |dy| < |dx| * esto (~51deg desde la vertical, un
// poco mas generoso que 45deg): un pulgar que barre de costado casi siempre
// arranca algo en diagonal, y con 45deg exactos se lo llevaba el scroll.
const HORIZONTAL_SLOPE = 1.25
const IGNORE_SELECTOR = '[data-swipe-ignore], input[type="range"], .sheet-scrim'

function isInsideHorizontalScroller(el: Element, root: Element): boolean {
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') return true
    }
  }
  return false
}

// Despues de un arrastre, el navegador igual sintetiza un click sobre lo que
// quedo bajo el dedo al soltar - sin esto, soltar encima de una card la abre.
function swallowNextClick() {
  const onClick = (event: MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
  }
  window.addEventListener('click', onClick, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', onClick, { capture: true }), 350)
}

export function useSectionSwipe(rootRef: Ref<HTMLElement | null>, pager: SectionPager): void {
  const tracker = createVelocityTracker()
  let tracking = false
  let claimed = false
  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let baseOffset = 0

  function claim(event: PointerEvent) {
    claimed = true
    try {
      rootRef.value?.setPointerCapture(event.pointerId)
    } catch {
      // Puntero sintetico/ya liberado: el gesto sigue igual sin captura.
    }
    baseOffset = pager.beginDrag()
  }

  function onPointerDown(event: PointerEvent) {
    const root = rootRef.value
    if (!root || event.pointerType === 'mouse' || !event.isPrimary) return
    if (!pager.canStartDrag() || event.clientX < EDGE_IGNORE_PX) return
    const target = event.target instanceof Element ? event.target : null
    if (target && (target.closest(IGNORE_SELECTOR) || isInsideHorizontalScroller(target, root))) return

    tracking = true
    claimed = false
    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    tracker.reset(event.timeStamp, event.clientX)
    // Tocar mientras la pagina todavia se esta asentando la "agarra" ahi
    // mismo (como en Instagram) en vez de ignorar el toque hasta que termine.
    if (pager.isSettling.value) claim(event)
  }

  function onPointerMove(event: PointerEvent) {
    if (!tracking || event.pointerId !== pointerId) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY

    if (!claimed) {
      if (Math.abs(dx) < CLAIM_THRESHOLD_PX && Math.abs(dy) < CLAIM_THRESHOLD_PX) return
      if (Math.abs(dy) >= Math.abs(dx) * HORIZONTAL_SLOPE) {
        tracking = false // Scroll vertical de la pagina: no es nuestro.
        return
      }
      claim(event)
    }

    tracker.add(event.timeStamp, event.clientX)
    pager.dragTo(baseOffset + dx)
  }

  function finish(event: PointerEvent, cancelled: boolean) {
    if (!tracking || event.pointerId !== pointerId) return
    tracking = false
    pointerId = null
    if (!claimed) return
    claimed = false
    if (!cancelled) swallowNextClick()
    pager.endDrag(cancelled ? 0 : tracker.velocity())
  }

  const onPointerUp = (event: PointerEvent) => finish(event, false)
  const onPointerCancel = (event: PointerEvent) => finish(event, true)

  // Una vez decidido que el gesto es horizontal, el navegador NO puede
  // scrollear: con touch-action:pan-y se quedaba con el componente vertical
  // de cualquier gesto un poco diagonal, scrolleaba la pagina y cancelaba el
  // arrastre (pointercancel) - medido con toques reales via CDP. Mismo truco
  // que Swiper/Hammer.js: preventDefault del touchmove (listener NO pasivo;
  // el pointermove del mismo movimiento corre antes y ya marco "claimed").
  function onTouchMove(event: TouchEvent) {
    if (claimed && event.cancelable) event.preventDefault()
  }

  onMounted(() => {
    const el = rootRef.value
    if (!el) return
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    el.addEventListener('touchmove', onTouchMove, { passive: false })
  })

  onBeforeUnmount(() => {
    const el = rootRef.value
    if (!el) return
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerCancel)
    el.removeEventListener('touchmove', onTouchMove)
  })
}
