import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'
import { SPRING_SNAPPY } from './springs'

// Hooks para <Transition :css="false"> de un elemento chico que "salta" al aparecer
// (una marca de seleccion, un badge): crece desde 0.4 con un resorte y sale con un
// fundido rapido y un poco de escala. Para aparecer sin ocupar espacio propio.
export function usePopTransition() {
  function onEnter(el: Element, done: () => void) {
    if (prefersReducedMotion()) return done()
    const target = el as HTMLElement
    const pop = animate(target, { scale: [0.4, 1], opacity: [0, 1] }, SPRING_SNAPPY)
    pop.finished.then(() => {
      target.style.transform = ''
      target.style.opacity = ''
      done()
    })
  }

  function onLeave(el: Element, done: () => void) {
    if (prefersReducedMotion()) return done()
    animate(el as HTMLElement, { scale: 0.6, opacity: 0 }, { duration: 0.15 }).finished.then(done)
  }

  return { onEnter, onLeave }
}
