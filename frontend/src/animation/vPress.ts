import type { Directive } from 'vue'
import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'
import { SPRING_SNAPPY } from './springs'

// Directiva v-press="escala" (default 0.97): el elemento se hunde un poco al
// tocarlo y vuelve con un resorte al soltar - el feedback de "boton fisico" de
// iOS. Reemplaza al :active { transform: scale() } por CSS en los elementos que
// la usan (un transform inline de Motion le ganaria a ese CSS igual).
type PressElement = HTMLElement & { __pressCleanup?: () => void }

const RELEASE_EVENTS = ['pointerup', 'pointerleave', 'pointercancel']

export const vPress: Directive<PressElement, number | undefined> = {
  mounted(el, binding) {
    if (prefersReducedMotion()) return
    const scale = binding.value ?? 0.97
    const down = () => animate(el, { scale }, SPRING_SNAPPY)
    const up = () => animate(el, { scale: 1 }, SPRING_SNAPPY)
    el.addEventListener('pointerdown', down)
    for (const name of RELEASE_EVENTS) el.addEventListener(name, up)
    el.__pressCleanup = () => {
      el.removeEventListener('pointerdown', down)
      for (const name of RELEASE_EVENTS) el.removeEventListener(name, up)
    }
  },
  unmounted(el) {
    el.__pressCleanup?.()
  },
}
