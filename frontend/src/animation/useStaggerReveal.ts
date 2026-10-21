import { onMounted, type Ref } from 'vue'
import { animate, stagger } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'

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

export function useStaggerReveal(container: Ref<HTMLElement | null>, selector = '[data-reveal]') {
  onMounted(() => {
    if (prefersReducedMotion() || !container.value) return
    const items = Array.from(container.value.querySelectorAll<HTMLElement>(selector))
    if (items.length === 0) return

    animate(
      items,
      { opacity: [0, 1], y: [REVEAL_RISE_PX, 0] },
      { duration: REVEAL_DURATION_S, delay: stagger(REVEAL_STEP_S), ease: EASE_OUT },
    ).finished.then(() => {
      for (const item of items) {
        item.style.transform = ''
        item.style.opacity = ''
      }
    })
  })
}
