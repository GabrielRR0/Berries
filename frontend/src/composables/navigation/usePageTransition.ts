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
// Orden horizontal de las secciones autenticadas, de izquierda a derecha,
// tal como aparecen en la barra inferior + los accesos rapidos del
// dashboard. Moverse a una seccion mas a la derecha desliza la pantalla
// nueva desde la derecha (como al deslizar entre tabs en apps mobile tipo
// Instagram); moverse a la izquierda desliza desde la izquierda.
const SECTION_ORDER = ['dashboard', 'movimientos', 'cuentas', 'analitica', 'deudas', 'metas', 'categorias', 'ajustes']

const transitionName = ref('fade')

function pathDepth(path: string): number {
  return path.split('/').filter(Boolean).length
}

function resolveTransitionName(
  to: RouteLocationNormalizedLoaded | { name?: unknown; path?: string },
  from: RouteLocationNormalizedLoaded | { name?: unknown; path?: string },
): string {
  const toIndex = SECTION_ORDER.indexOf(String(to.name))
  const fromIndex = SECTION_ORDER.indexOf(String(from.name))

  if (toIndex !== -1 && fromIndex !== -1 && toIndex !== fromIndex) {
    return toIndex > fromIndex ? 'slide-left' : 'slide-right'
  }

  // Fallback por profundidad de path: SECTION_ORDER solo modela las secciones
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
  transitionName.value = resolveTransitionName(to, from)
}
