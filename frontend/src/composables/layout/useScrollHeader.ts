import { onMounted, onUnmounted, ref } from 'vue'
import { useSectionScroller } from '../navigation/sectionContext'

// El header (TopHeader.vue / SectionHeader.vue) arranca transparente sobre el
// contenido y solo se vuelve cristal/blur al hacer scroll hacia abajo - pedido
// explicito del usuario, mismo patron que las apps nativas de telefono.
// Dentro del paginador de secciones cada pagina scrollea en su propio
// contenedor (ver sectionContext.ts) - fuera de el, el scroll es el de window.
const SCROLL_THRESHOLD_PX = 12

export function useScrollHeader() {
  const isScrolled = ref(false)
  const scroller = useSectionScroller()
  let target: HTMLElement | Window | null = null

  function onScroll() {
    const top = target instanceof HTMLElement ? target.scrollTop : window.scrollY
    isScrolled.value = top > SCROLL_THRESHOLD_PX
  }

  onMounted(() => {
    target = scroller?.value ?? window
    onScroll()
    target.addEventListener('scroll', onScroll, { passive: true })
  })

  onUnmounted(() => {
    target?.removeEventListener('scroll', onScroll)
  })

  return { isScrolled }
}
