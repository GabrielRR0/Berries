import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { forceNextTransition } from './usePageTransition'

// Deslizar en una pantalla SUELTA (Metas, Deudas, Analisis, Categorias,
// Calculadora, crear/editar meta...): solo se desliza entre las 4 paginas de
// la barra flotante (SectionPager.vue), asi que en cualquier otra el gesto
// horizontal vuelve a la pagina anterior - o a Inicio si no hay anterior.
// Esto solo decide QUE hizo el dedo y a donde ir; el movimiento lo hace el
// <Transition> de App.vue con la direccion del dedo.

// Mismos umbrales que useSectionSwipe.ts, para que las dos pantallas se
// sientan igual.
const EDGE_IGNORE_PX = 24 // No robarle al SO el gesto de "volver" desde el borde.
const HORIZONTAL_SLOPE = 1.25 // Horizontal si |dy| < |dx| * esto.
const COMMIT_DISTANCE_PX = 72
const FLICK_DISTANCE_PX = 40
const FLICK_VELOCITY_PX_MS = 0.5
const IGNORE_SELECTOR = '[data-swipe-ignore], input[type="range"], .sheet-scrim'

// +1 = dedo hacia la derecha (la pagina "sale" hacia la derecha), -1 = hacia
// la izquierda, 0 = no cuenta como deslizar de pagina.
export function classifySwipe(dx: number, dy: number, elapsedMs: number): 1 | -1 | 0 {
  if (Math.abs(dy) >= Math.abs(dx) * HORIZONTAL_SLOPE) return 0
  const velocity = Math.abs(dx) / Math.max(elapsedMs, 1)
  const committed =
    Math.abs(dx) >= COMMIT_DISTANCE_PX || (Math.abs(dx) >= FLICK_DISTANCE_PX && velocity >= FLICK_VELOCITY_PX_MS)
  if (!committed) return 0
  return dx > 0 ? 1 : -1
}

// A donde ir: la pagina anterior del historial si la hay y es de la app (no
// el login), o Inicio. Con el historial real (y no con "la ultima pagina de
// la barra") un deslizar desde "Nueva meta" vuelve a Metas, no al Menu, y
// dos pantallas sueltas nunca quedan rebotando entre si.
export function resolveSwipeBack(historyBack: unknown): 'back' | 'home' {
  if (typeof historyBack !== 'string' || historyBack === '') return 'home'
  if (/^\/(login|register)(\/|\?|$)/.test(historyBack)) return 'home'
  return 'back'
}

function isInsideHorizontalScroller(el: Element, root: Element): boolean {
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') return true
    }
  }
  return false
}

export function useLooseRouteSwipe(rootRef: Ref<HTMLElement | null>, isEnabled: () => boolean): void {
  const router = useRouter()
  let tracking = false
  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let startTime = 0

  function goBack(direction: 1 | -1) {
    forceNextTransition(direction > 0 ? 'slide-right' : 'slide-left')
    if (resolveSwipeBack(window.history.state?.back) === 'back') router.back()
    else router.push({ name: 'dashboard' })
  }

  function onPointerDown(event: PointerEvent) {
    const root = rootRef.value
    if (!root || !isEnabled() || event.pointerType === 'mouse' || !event.isPrimary) return
    if (event.clientX < EDGE_IGNORE_PX) return
    const target = event.target instanceof Element ? event.target : null
    if (target && (target.closest(IGNORE_SELECTOR) || isInsideHorizontalScroller(target, root))) return

    tracking = true
    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    startTime = event.timeStamp
  }

  function onPointerUp(event: PointerEvent) {
    if (!tracking || event.pointerId !== pointerId) return
    tracking = false
    pointerId = null
    const direction = classifySwipe(event.clientX - startX, event.clientY - startY, event.timeStamp - startTime)
    if (direction !== 0 && isEnabled()) goBack(direction)
  }

  function onPointerCancel(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    tracking = false
    pointerId = null
  }

  onMounted(() => {
    const el = rootRef.value
    if (!el) return
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
  })

  onBeforeUnmount(() => {
    const el = rootRef.value
    if (!el) return
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerCancel)
  })
}
