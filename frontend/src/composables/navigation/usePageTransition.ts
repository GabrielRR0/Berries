import { ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

// Modulo de transiciones de pagina - "bien establecido y dinamico" (pedido
// explicito del usuario): un solo lugar que decide COMO se anima cada
// cambio de ruta, reutilizable para cualquier navegacion futura, sin
// libreria externa (GSAP/Framer Motion estan vetados en DESIGN.md raiz por
// pesados; un slide direccional simple no necesita mas que CSS nativo via
// el <Transition> de Vue - ver App.vue y las clases .slide-*/.fade-* de
// style.css).
//
// El orden horizontal de las secciones (izquierda a derecha) vive en
// route.meta.order (ver router/index.ts) - no en un array propio: antes
// habia un SECTION_ORDER hardcodeado aca que ya se habia desincronizado del
// orden real del router y del array de BottomTabBar.vue (pedido explicito
// del usuario: agregar una vista nueva tiene que ser modular, un solo lugar
// para tocar). Moverse a una seccion de order mas alto desliza la pantalla
// nueva desde la derecha (como al deslizar entre tabs en apps mobile tipo
// Instagram); moverse a un order mas bajo desliza desde la izquierda.

const transitionName = ref('fade')

// Bug real reportado por el usuario: al deslizar con el gesto nativo de
// "volver" del telefono (el swipe desde el borde en iOS Safari, o el gesto/
// boton de atras en Android), ese gesto ya anima la pagina por su cuenta -
// el navegador la arrastra siguiendo el dedo. Si DESPUES nuestro propio
// <Transition> (ver App.vue) tambien anima el mismo cambio de ruta desde
// cero, la pagina parece "arrastrarse sola" una segunda vez apenas termina
// el gesto. popstate es el mismo evento tanto para ese gesto como para el
// boton de atras del navegador - se escucha aca (import que corre ANTES de
// que router/index.ts llame a createRouter/createWebHistory, ver orden de
// imports) para marcar la bandera antes de que el listener interno de
// vue-router dispare los guards de router.beforeEach.
let isPopNavigation = false
window.addEventListener(
  'popstate',
  () => {
    isPopNavigation = true
  },
  true,
)

// Mismo mecanismo que isPopNavigation, para el mismo motivo: useSectionPager.ts
// ya termino de deslizar la pagina con el gesto antes de llamar a router.push -
// el paginador lee este 'none' para cambiar de seccion al instante en vez de
// animar el mismo cambio una segunda vez.
let suppressNext = false
export function suppressNextTransition(): void {
  suppressNext = true
}

// Direccion elegida a mano para la PROXIMA navegacion (la usa el gesto de
// deslizar en una pantalla suelta, ver useLooseRouteSwipe.ts): ese gesto no
// anima nada por su cuenta, asi que la animacion tiene que ser la del
// <Transition> - incluso si la navegacion es un router.back() (popstate), que
// de otro modo se marcaria como "ya animada por el navegador".
let forcedNext: string | null = null
export function forceNextTransition(name: 'slide-left' | 'slide-right'): void {
  forcedNext = name
}

function pathDepth(path: string): number {
  return path.split('/').filter(Boolean).length
}

type TransitionRoute = RouteLocationNormalizedLoaded | { name?: unknown; path?: string; meta?: { order?: number } }

function resolveTransitionName(to: TransitionRoute, from: TransitionRoute): string {
  const toOrder = to.meta?.order
  const fromOrder = from.meta?.order

  if (typeof toOrder === 'number' && typeof fromOrder === 'number' && toOrder !== fromOrder) {
    return toOrder > fromOrder ? 'slide-left' : 'slide-right'
  }

  // Fallback por profundidad de path: meta.order solo modela las secciones
  // de nivel superior, no sub-rutas anidadas dentro de una misma seccion (ej.
  // /metas -> /metas/nueva, o /metas -> /metas/:id/editar) - "entrar" a algo
  // mas profundo desliza para adelante, "volver" desliza para atras, igual
  // sensacion que el resto de la navegacion.
  const toPath = 'path' in to && to.path ? to.path : ''
  const fromPath = 'path' in from && from.path ? from.path : ''
  if (!toPath || !fromPath) return 'fade'

  const toDepth = pathDepth(toPath)
  const fromDepth = pathDepth(fromPath)
  if (toDepth === fromDepth) return 'fade'
  return toDepth > fromDepth ? 'slide-left' : 'slide-right'
}

export function usePageTransitionName() {
  return transitionName
}

// Llamado desde router/index.ts en cada navegacion, antes de que el nuevo
// componente se monte - así <Transition :name="transitionName"> en App.vue
// ya tiene el nombre correcto cuando Vue reacciona al cambio de ruta.
export function updatePageTransitionName(
  to: RouteLocationNormalizedLoaded | { name?: unknown },
  from: RouteLocationNormalizedLoaded | { name?: unknown },
): void {
  if (forcedNext) {
    transitionName.value = forcedNext
    forcedNext = null
    isPopNavigation = false
    suppressNext = false
    return
  }
  if (isPopNavigation || suppressNext) {
    isPopNavigation = false
    suppressNext = false
    // 'none' no matchea ningun .none-enter-active/.none-leave-active en
    // style.css a proposito - Vue hace el cambio de contenido al instante,
    // sin animacion propia, dejando que la unica animacion visible sea la
    // que ya hizo el propio navegador (gesto/boton de atras) o la que ya
    // hizo el paginador de secciones con el gesto (useSectionPager.ts).
    transitionName.value = 'none'
    return
  }
  transitionName.value = resolveTransitionName(to, from)
}
