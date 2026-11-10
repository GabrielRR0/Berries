import type { Directive } from 'vue'
import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'

// Directiva v-grow-column="ratio" (0-1) para barras verticales de un grafico: la barra crece
// desde la base hasta su proporcion al montarse y, si cambia (otro periodo), se desliza al
// nuevo valor con un resorte. Hermana de v-grow-bar (horizontal). Anima el alto en % del
// contenedor, que debe tener alto fijo y alinear la barra abajo. `data-grow-delay` (segundos)
// escalona las barras de un mismo grafico.
const GROW_DURATION_S = 0.8
const BASE_DELAY_S = 0.15

function toPercent(ratio: number): string {
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
  return `${(safe * 100).toFixed(2)}%`
}

export const vGrowColumn: Directive<HTMLElement, number> = {
  mounted(el, binding) {
    const target = toPercent(binding.value)
    if (prefersReducedMotion()) {
      el.style.height = target
      return
    }
    el.style.height = '0%'
    const delay = BASE_DELAY_S + Number(el.dataset.growDelay ?? 0)
    animate(el, { height: target }, { duration: GROW_DURATION_S, delay, ease: [0.16, 1, 0.3, 1] })
  },
  updated(el, binding) {
    if (binding.value === binding.oldValue) return
    const target = toPercent(binding.value)
    if (prefersReducedMotion()) {
      el.style.height = target
      return
    }
    animate(el, { height: target }, { type: 'spring', bounce: 0.1, visualDuration: 0.5 })
  },
}
