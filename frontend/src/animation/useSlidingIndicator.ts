import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'
import { SPRING_SNAPPY } from './springs'

// Indicador deslizante de un control segmentado (como el de iOS): una pastilla
// que se desplaza con un resorte hasta la opcion activa en vez de que el fondo
// "salte" de un boton a otro. El contenedor debe ser position:relative y la
// opcion activa llevar data-active="true"; el indicador es un hijo absoluto
// (top/bottom/left:0). Se recoloca sin animar al montar y al cambiar el ancho
// (ej. etiqueta corta -> larga al cruzar un breakpoint).
export function useSlidingIndicator(
  container: Ref<HTMLElement | null>,
  indicator: Ref<HTMLElement | null>,
  activeKey: () => unknown,
) {
  let observer: ResizeObserver | null = null

  function place(animated: boolean) {
    const active = container.value?.querySelector<HTMLElement>('[data-active="true"]')
    const pill = indicator.value
    if (!active || !pill) return
    const target = { x: active.offsetLeft, width: active.offsetWidth }
    if (!animated || prefersReducedMotion()) animate(pill, target, { duration: 0 })
    else animate(pill, target, SPRING_SNAPPY)
  }

  onMounted(() => {
    place(false)
    if (container.value && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => place(false))
      observer.observe(container.value)
    }
  })
  onBeforeUnmount(() => observer?.disconnect())

  watch(activeKey, async () => {
    await nextTick()
    place(true)
  })
}
