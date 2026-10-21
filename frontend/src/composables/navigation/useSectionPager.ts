import { computed, onBeforeUnmount, ref, shallowRef, watch, type CSSProperties, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSwipeSettle } from '../../animation/useSwipeSettle'
import { sectionsFromRoutes, useSectionComponents } from './useSectionComponents'
import { suppressNextTransition, usePageTransitionName } from './usePageTransition'

// Paginador horizontal de secciones (las rutas con meta.order) - mismo modelo
// que ViewPager2 de Android / Swiper / las tabs de Instagram:
//  - cada seccion es UNA instancia persistente; la que se ve durante el
//    arrastre es la misma que queda activa al soltar (antes se montaba una
//    copia temporal para el arrastre y otra nueva al navegar: doble fetch y
//    spinner justo al terminar el gesto).
//  - las vecinas (activa +-1, "offscreenPageLimit = 1") quedan montadas de
//    antemano, con sus datos ya pedidos, listas para revelarse.
//  - el contenedor que recorta NO se mueve; se mueve cada pagina por
//    separado (antes el overflow:clip viajaba con el elemento trasladado y
//    recortaba siempre a la vecina - solo se veia el brillo del grafico).
// La ruta sigue siendo la fuente de verdad: un tap en la barra, un push
// programatico o el boton atras mueven el paginador; el gesto, al
// confirmarse, hace router.push recien al terminar de asentarse.
const COMMIT_PROJECTION_MS = 180 // Cuanto "sigue" el flick despues de soltar (proyeccion tipo iOS).
const RUBBER_BAND_RATIO = 0.3 // Resistencia al arrastrar hacia un lado sin vecino.
const WINDOW_SETTLE_DELAY_MS = 120 // Montar/desmontar vecinas despues de la animacion, no durante.

type Incoming = { index: number; dir: 1 | -1 }

export function useSectionPager(rootRef: Ref<HTMLElement | null>) {
  const router = useRouter()
  const route = useRoute()
  const transitionName = usePageTransitionName()
  const sections = sectionsFromRoutes(router.getRoutes())
  const { resolved, ensureResolved, preloadAll } = useSectionComponents(sections)

  const activeIndex = ref<number | null>(null)
  const windowCenter = ref<number | null>(null)
  const offset = ref(0)
  const incoming = shallowRef<Incoming | null>(null)
  const isDragging = ref(false)
  const isSettling = ref(false)
  let width = window.innerWidth
  let windowTimer: ReturnType<typeof setTimeout> | undefined
  let preloaded = false
  // Cada gesto/animacion nueva invalida la anterior: si el dedo "agarra" la
  // pagina a mitad de un asentamiento, lo que iba a pasar al terminar ese
  // asentamiento (activar la vecina, router.push) ya no tiene que pasar.
  let motionToken = 0

  const { settleTo, stop } = useSwipeSettle(offset)

  const indexOf = (name: unknown) => sections.findIndex((s) => s.name === name)
  const isOnSection = computed(() => indexOf(route.name) !== -1)
  const isMoving = computed(() => isDragging.value || isSettling.value)

  const mountedIndices = computed(() => {
    const set = new Set<number>()
    const center = windowCenter.value
    if (center !== null) {
      for (const i of [center - 1, center, center + 1]) if (i >= 0 && i < sections.length) set.add(i)
    }
    if (activeIndex.value !== null) set.add(activeIndex.value)
    if (incoming.value) set.add(incoming.value.index)
    return set
  })

  watch(
    mountedIndices,
    (indices) => indices.forEach((i) => ensureResolved(sections[i]).catch(() => {})),
    { immediate: true },
  )

  function measure() {
    width = rootRef.value?.clientWidth || window.innerWidth
  }

  function setWindowCenter(index: number, immediate = false) {
    clearTimeout(windowTimer)
    if (immediate) windowCenter.value = index
    else windowTimer = setTimeout(() => (windowCenter.value = index), WINDOW_SETTLE_DELAY_MS)
  }

  function activate(index: number, immediate = false) {
    stop()
    motionToken++
    activeIndex.value = index
    incoming.value = null
    offset.value = 0
    isDragging.value = false
    isSettling.value = false
    setWindowCenter(index, immediate)
    if (!preloaded) {
      preloaded = true
      preloadAll(index)
    }
  }

  // Tap en la barra / push programatico: la seccion destino entra pegada al
  // borde del lado que le corresponde por orden, aunque no sea vecina directa.
  async function animateTo(index: number) {
    const from = activeIndex.value
    if (from === null) return activate(index, true)
    await ensureResolved(sections[index]).catch(() => {})
    measure()
    const dir: 1 | -1 = index > from ? 1 : -1
    const token = ++motionToken
    incoming.value = { index, dir }
    isSettling.value = true
    await settleTo(-dir * width)
    if (token === motionToken) activate(index)
  }

  watch(
    () => route.name,
    (name, previousName) => {
      const index = indexOf(name)
      if (index === -1) return
      if (activeIndex.value === null) return activate(index, true)
      if (index === activeIndex.value) return
      const cameFromSection = indexOf(previousName) !== -1
      // 'none' = boton/gesto atras del sistema o un commit de nuestro propio
      // gesto (ver usePageTransition.ts): ya hubo animacion, cambio directo.
      if (!cameFromSection || transitionName.value === 'none' || isMoving.value) return activate(index)
      animateTo(index)
    },
    { immediate: true },
  )

  function neighborExists(dir: 1 | -1): boolean {
    const i = (activeIndex.value ?? -1) + dir
    return activeIndex.value !== null && i >= 0 && i < sections.length
  }

  // Un salto por la barra (incoming) no se puede agarrar; un asentamiento de
  // arrastre si (ver beginDrag).
  function canStartDrag(): boolean {
    return isOnSection.value && activeIndex.value !== null && !incoming.value
  }

  // Devuelve el offset desde el que arranca el gesto: 0 en reposo, o donde
  // haya quedado la pagina si el dedo la agarro a mitad del asentamiento.
  function beginDrag(): number {
    stop()
    motionToken++
    if (!isSettling.value) measure()
    isSettling.value = false
    isDragging.value = true
    return offset.value
  }

  function dragTo(dx: number) {
    const dir: 1 | -1 = dx < 0 ? 1 : -1
    offset.value = neighborExists(dir) ? Math.max(-width, Math.min(width, dx)) : dx * RUBBER_BAND_RATIO
  }

  async function endDrag(velocityPxPerMs: number) {
    if (activeIndex.value === null) return
    const dx = offset.value
    const dir: 1 | -1 = dx < 0 ? 1 : -1
    const projected = dx + velocityPxPerMs * COMMIT_PROJECTION_MS
    const commit =
      neighborExists(dir) && Math.sign(projected) === Math.sign(dx) && Math.abs(projected) > width / 2

    isDragging.value = false
    isSettling.value = true
    const target = activeIndex.value + dir
    const token = ++motionToken

    if (!commit) {
      await settleTo(0, velocityPxPerMs * 1000)
      if (token === motionToken) isSettling.value = false
      return
    }

    await settleTo(-dir * width, velocityPxPerMs * 1000)
    if (token !== motionToken) return
    // Mismo pixel antes y despues: la vecina estaba en offset + dir*width = 0.
    activate(target)
    suppressNextTransition()
    router.push(sections[target].path)
  }

  function paneStyle(index: number): CSSProperties {
    const active = activeIndex.value
    if (active === null) return { visibility: 'hidden' }
    if (index === active) {
      // En reposo SIN transform: un transform convierte a la pagina en el
      // containing block de sus position:fixed (headers, sheets) y en un
      // stacking context propio - en reposo tienen que comportarse normal.
      return isMoving.value ? { transform: `translate3d(${offset.value}px, 0, 0)` } : {}
    }
    const slot = incoming.value
      ? incoming.value.index === index
        ? incoming.value.dir
        : null
      : isMoving.value && Math.abs(index - active) === 1
        ? index - active
        : null
    if (slot !== null) return { transform: `translate3d(${offset.value + slot * width}px, 0, 0)` }
    return { transform: `translate3d(${index < active ? -100 : 100}%, 0, 0)`, visibility: 'hidden' }
  }

  function isPaneActive(index: number): boolean {
    return index === activeIndex.value && !incoming.value && isOnSection.value
  }

  onBeforeUnmount(() => {
    clearTimeout(windowTimer)
    stop()
  })

  return {
    sections,
    resolved,
    mountedIndices,
    isOnSection,
    isMoving,
    isSettling,
    paneStyle,
    isPaneActive,
    canStartDrag,
    beginDrag,
    dragTo,
    endDrag,
  }
}

export type SectionPager = ReturnType<typeof useSectionPager>
