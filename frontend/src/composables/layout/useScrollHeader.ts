import { onMounted, onUnmounted, ref } from 'vue'

// El header (TopHeader.vue) arranca transparente sobre el contenido y solo
// se vuelve cristal/blur al hacer scroll hacia abajo - pedido explicito del
// usuario, mismo patron que las apps nativas de telefono. TopHeader.vue no
// hace llamadas directas a window/document (ver su propio comentario, listo
// para @ionic/vue), asi que ese acceso vive aca y App.vue le pasa el
// resultado como prop.
const SCROLL_THRESHOLD_PX = 12

export function useScrollHeader() {
  const isScrolled = ref(false)

  function onScroll() {
    isScrolled.value = window.scrollY > SCROLL_THRESHOLD_PX
  }

  onMounted(() => {
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
  })

  return { isScrolled }
}
