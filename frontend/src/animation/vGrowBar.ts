import type { Directive } from 'vue'
import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'

// Directiva v-grow-bar="ratio" (0-1) para barras de progreso: la barra
// crece desde la izquierda hasta su proporcion al montarse y, si la
// proporcion cambia despues (ej. otro mes), se desliza al nuevo valor con un
// resorte en vez de saltar. El elemento solo necesita ancho completo y
// transform-origin izquierdo (lo hace la directiva) - la proporcion vive en
// transform:scaleX, asi no dispara layout.
const GROW_DURATION_S = 1.1
const GROW_DELAY_S = 0.35

function clamp(ratio: number): number {
  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
}

export const vGrowBar: Directive<HTMLElement, number> = {
  mounted(el, binding) {
    const target = clamp(binding.value)
    el.style.transformOrigin = 'left center'
    if (prefersReducedMotion()) {
      el.style.transform = `scaleX(${target})`
      return
    }
    el.style.transform = 'scaleX(0)'
    animate(el, { scaleX: target }, { duration: GROW_DURATION_S, delay: GROW_DELAY_S, ease: [0.16, 1, 0.3, 1] })
  },
  updated(el, binding) {
    if (binding.value === binding.oldValue) return
    const target = clamp(binding.value)
    if (prefersReducedMotion()) {
      el.style.transform = `scaleX(${target})`
      return
    }
    animate(el, { scaleX: target }, { type: 'spring', bounce: 0.15, visualDuration: 0.5 })
  },
}
