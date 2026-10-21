import { defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, type Component, type Ref } from 'vue'
import type { RouteRecordNormalized } from 'vue-router'
import { useRouter } from 'vue-router'
import { useSwipeSettle } from '../../animation/useSwipeSettle'
import { suppressNextTransition } from './usePageTransition'

// Arrastre horizontal entre secciones (pedido explicito del usuario: "si
// estoy en el home y arrastro hacia movimientos, quiero que se sienta todo
// fluido"), solo en moviles/tablets (gate por pointerType, no por ancho de
// pantalla - un laptop con pantalla tactil tambien cuenta, un mouse nunca).
// Mismo criterio que BottomSheet.vue: nada de libreria de gestos (vetada en
// DESIGN.md por pesada), Pointer Events nativos nomas - el unico uso de
// libreria de animacion es useSwipeSettle.ts (Motion One, ver
// src/animation/README.md), para el asentamiento final del gesto.
//
// El vecino a donde navega cada direccion sale de route.meta.order (ver
// router/index.ts) - la misma fuente que ya usa usePageTransition.ts para
// decidir el slide-left/slide-right, asi que el gesto termina en el mismo
// <Transition> de siempre, sin logica de animacion duplicada.
const EDGE_IGNORE_PX = 24 // No roba el gesto nativo de "volver" del borde del SO.
const CLAIM_THRESHOLD_PX = 10 // Minimo de movimiento antes de decidir si es horizontal o vertical.
const COMMIT_DISTANCE_RATIO = 0.25 // % del ancho del viewport para confirmar el cambio de pagina.
const COMMIT_VELOCITY = 0.5 // px/ms - un flick rapido confirma aunque no haya llegado a la distancia.
const RUBBER_BAND_RATIO = 0.35 // Resistencia al arrastrar hacia un lado sin vecino (efecto rebote).

// Cache de componentes async por nombre de ruta - evita que defineAsyncComponent()
// cree un componente nuevo (y remonte el preview) en cada pointermove mientras se
// arrastra hacia el mismo vecino.
const asyncComponentCache = new Map<string, Component>()

function resolvePreviewComponent(record: RouteRecordNormalized): Component | null {
  const raw = record.components?.default
  if (!raw) return null
  // Todas las rutas del router se declaran con `component: () => import(...)`
  // (code-splitting por pantalla) - sin defineAsyncComponent(), Vue no sabe
  // esperar esa promesa y falla al intentar renderizarla directo.
  if (typeof raw !== 'function') return raw as Component
  const key = String(record.name ?? record.path)
  const cached = asyncComponentCache.get(key)
  if (cached) return cached
  const wrapped = defineAsyncComponent(raw as () => Promise<Component>)
  asyncComponentCache.set(key, wrapped)
  return wrapped
}

export function useSwipeNavigation(viewportRef: Ref<HTMLElement | null>): {
  dragX: Ref<number>
  previewComponent: Ref<Component | null>
  previewSide: Ref<'left' | 'right' | null>
} {
  const router = useRouter()
  // Reactivo (no un el.style.transform a mano): App.vue lo liga con :style al
  // mismo viewport, mismo patron que dragOffset en BottomSheet.vue - asi
  // useSwipeSettle.ts (Motion One) puede animarlo frame a frame sin que este
  // composable toque el DOM directo.
  const dragX = ref(0)
  // El vecino se renderiza DE VERDAD mientras se arrastra (pedido explicito del
  // usuario, "como Instagram") - antes el drag solo trasladaba la pagina actual,
  // dejando ver el fondo negro vacio donde deberia estar la pagina siguiente
  // (bug real confirmado con Playwright: la caja de abajo). App.vue monta este
  // componente en una capa aparte, a un costado del viewport, que se revela al
  // mismo tiempo que la pagina actual se corre (ver .swipe-preview en style.css).
  const previewComponent = shallowRef<Component | null>(null)
  const previewSide = shallowRef<'left' | 'right' | null>(null)
  const { settleTo } = useSwipeSettle(dragX)

  let tracking = false
  let claimed = false
  let startX = 0
  let startY = 0
  let startTime = 0
  let pointerId: number | null = null

  function orderedNeighbor(direction: 1 | -1) {
    const currentOrder = router.currentRoute.value.meta.order
    if (typeof currentOrder !== 'number') return null
    return (
      router
        .getRoutes()
        .find((r) => r.meta.order === currentOrder + direction) ?? null
    )
  }

  function updatePreview(direction: 1 | -1) {
    const neighbor = orderedNeighbor(direction)
    if (!neighbor) {
      previewComponent.value = null
      previewSide.value = null
      return
    }
    previewComponent.value = resolvePreviewComponent(neighbor)
    // direction 1 = arrastrando hacia la izquierda = el vecino entra por la
    // derecha (mismo criterio que slide-left en usePageTransition.ts).
    previewSide.value = direction === 1 ? 'right' : 'left'
  }

  function clearPreview() {
    previewComponent.value = null
    previewSide.value = null
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse') return
    if (event.clientX < EDGE_IGNORE_PX) return
    if (typeof router.currentRoute.value.meta.order !== 'number') return

    tracking = true
    claimed = false
    startX = event.clientX
    startY = event.clientY
    startTime = event.timeStamp
    pointerId = event.pointerId
  }

  function onPointerMove(event: PointerEvent) {
    if (!tracking || event.pointerId !== pointerId) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY

    if (!claimed) {
      if (Math.abs(dx) < CLAIM_THRESHOLD_PX && Math.abs(dy) < CLAIM_THRESHOLD_PX) return
      if (Math.abs(dy) >= Math.abs(dx)) {
        // Gesto vertical: es scroll de la lista, no nuestro - se deja de
        // trackear este puntero hasta el proximo pointerdown.
        tracking = false
        return
      }
      claimed = true
    }

    const direction = dx < 0 ? 1 : -1
    const hasNeighbor = Boolean(orderedNeighbor(direction))
    // Se recalcula en cada move (no solo al reclamar el gesto) por si el
    // usuario invierte la direccion a mitad de camino - el preview tiene que
    // seguir mostrando el vecino correcto para ese lado.
    if (hasNeighbor) updatePreview(direction)
    else clearPreview()
    dragX.value = hasNeighbor ? dx : dx * RUBBER_BAND_RATIO
  }

  async function onPointerEnd(event: PointerEvent) {
    if (!tracking || event.pointerId !== pointerId) return
    tracking = false

    if (!claimed) return
    claimed = false

    const width = viewportRef.value?.clientWidth || window.innerWidth
    const dx = event.clientX - startX
    const elapsed = event.timeStamp - startTime || 1
    const velocity = Math.abs(dx) / elapsed
    const direction = dx < 0 ? 1 : -1
    const target = orderedNeighbor(direction)

    const shouldCommit = Boolean(target) && (Math.abs(dx) > width * COMMIT_DISTANCE_RATIO || velocity > COMMIT_VELOCITY)

    if (shouldCommit && target) {
      // Termina de deslizar a mano hasta el final (el preview ya es la pagina
      // real, asi que esto se siente igual que si ya hubieramos navegado) y
      // RECIEN ahi cambia la ruta - con el <Transition> de App.vue apagado
      // para este cambio (suppressNextTransition) para no reanimar un gesto
      // que el usuario ya vio terminar con su propio dedo.
      await settleTo(direction === 1 ? -width : width)
      suppressNextTransition()
      await router.push(target.path)
      // Fuerza a Vue a pintar la pagina real ANTES de soltar el preview y
      // resetear dragX - sin este tick quedaria un frame con la pagina real
      // ya montada pero el viewport todavia corrido.
      await nextTick()
    } else {
      await settleTo(0)
    }

    dragX.value = 0
    clearPreview()
  }

  onMounted(() => {
    const el = viewportRef.value
    if (!el) return
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerEnd)
    el.addEventListener('pointercancel', onPointerEnd)
  })

  onBeforeUnmount(() => {
    const el = viewportRef.value
    if (!el) return
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerEnd)
    el.removeEventListener('pointercancel', onPointerEnd)
  })

  return { dragX, previewComponent, previewSide }
}
