import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'
import { SPRING_SMOOTH } from './springs'

// Hooks para <Transition :css="false"> de un bloque que reemplaza a otro (cargando
// -> lista -> vacio) o que aparece/desaparece sin ocupar espacio propio (un
// mensaje de error): entra con fundido + una subida corta de resorte y sale con un
// fundido rapido, sin animar el alto. Para bloques que si ocupan espacio y deben
// empujar al resto con suavidad, usar useCollapseTransition.ts.
const RISE_PX = 10
const LEAVE_S = 0.16
const EASE_OUT = [0.16, 1, 0.3, 1] as const

export function useFadeTransition() {
  function onBeforeEnter(el: Element) {
    if (!prefersReducedMotion()) (el as HTMLElement).style.opacity = '0'
  }

  function onEnter(el: Element, done: () => void) {
    const target = el as HTMLElement
    if (prefersReducedMotion()) return done()
    const fade = animate(target, { opacity: [0, 1] }, { duration: 0.35, ease: EASE_OUT })
    const rise = animate(target, { y: [RISE_PX, 0] }, SPRING_SMOOTH)
    Promise.all([fade.finished, rise.finished]).then(() => {
      target.style.opacity = ''
      target.style.transform = ''
      done()
    })
  }

  function onLeave(el: Element, done: () => void) {
    if (prefersReducedMotion()) return done()
    animate(el as HTMLElement, { opacity: 0 }, { duration: LEAVE_S, ease: EASE_OUT }).finished.then(done)
  }

  return { onBeforeEnter, onEnter, onLeave }
}
