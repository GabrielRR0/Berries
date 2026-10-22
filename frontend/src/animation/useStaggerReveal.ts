import { onMounted, type Ref } from 'vue'
import { animate, stagger } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'
import { SPRING_SMOOTH } from './springs'

// Entrada escalonada de las secciones de una pantalla (fade + subida): cada
// hijo marcado con [data-reveal] del contenedor aparece un instante despues
// del anterior. Reemplaza al @keyframes content-enter por CSS, que solo
// alcanzaba escritorio y no podia escalonar sin delays hardcodeados por
// clase. Al terminar limpia el transform/opacity inline: un transform
// residual crearia un bloque contenedor para cualquier descendiente
// position:fixed (los BottomSheet viven dentro de algunas secciones).
const REVEAL_DURATION_S = 0.7
const REVEAL_STEP_S = 0.1
const REVEAL_RISE_PX = 16
const EASE_OUT = [0.16, 1, 0.3, 1] as const

// spring: entrada "tipo iOS" (resorte en la subida, mas corta y rapida) en vez del
// tween por defecto - la usa Movimientos; Inicio conserva el tween de siempre.
export interface StaggerRevealOptions {
  selector?: string
  spring?: boolean
  rise?: number
  step?: number
}

export function useStaggerReveal(container: Ref<HTMLElement | null>, options: StaggerRevealOptions | string = {}) {
  const {
    selector = '[data-reveal]',
    spring = false,
    rise = REVEAL_RISE_PX,
    step = REVEAL_STEP_S,
  } = typeof options === 'string' ? { selector: options } : options

  onMounted(() => {
    if (prefersReducedMotion() || !container.value) return
    const items = Array.from(container.value.querySelectorAll<HTMLElement>(selector))
    if (items.length === 0) return

    const fade = spring ? animate(items, { opacity: [0, 1] }, { duration: 0.45, delay: stagger(step), ease: EASE_OUT }) : null
    const move = spring
      ? animate(items, { y: [rise, 0] }, { ...SPRING_SMOOTH, delay: stagger(step) })
      : animate(
          items,
          { opacity: [0, 1], y: [rise, 0] },
          { duration: REVEAL_DURATION_S, delay: stagger(step), ease: EASE_OUT },
        )
    Promise.all([fade?.finished, move.finished]).then(() => {
      for (const item of items) {
        item.style.transform = ''
        item.style.opacity = ''
      }
    })
  })
}
