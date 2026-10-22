import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'
import { SPRING_SMOOTH } from './springs'

// Hooks para <Transition :css="false"> que abren/cierran un bloque animando su
// alto (y opacidad) con Motion: el detalle expandible de una fila de
// Movimientos y la lista de pendientes. El alto se anima en px y al terminar se
// limpia para que el contenido vuelva a ser fluido (responsive). Quien lo use
// solo conecta los hooks: `<Transition :css="false" @enter="onEnter" @leave="onLeave">`.
const DURATION_S = 0.32
const EASE_OUT = [0.16, 1, 0.3, 1] as const

function clear(el: HTMLElement) {
  el.style.height = ''
  el.style.opacity = ''
  el.style.overflow = ''
  el.style.paddingTop = ''
  el.style.paddingBottom = ''
}

// Un bloque con padding no puede achicarse por debajo de el (box-sizing:
// border-box): se anima tambien para que arranque/termine en 0 de verdad.
function paddings(el: HTMLElement): { top: number; bottom: number } {
  const style = getComputedStyle(el)
  return { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0 }
}

export function useCollapseTransition() {
  function onEnter(el: Element, done: () => void) {
    const target = el as HTMLElement
    if (prefersReducedMotion()) return done()
    const height = target.scrollHeight
    const { top, bottom } = paddings(target)
    target.style.overflow = 'hidden'
    animate(
      target,
      { height: [0, height], opacity: [0, 1], paddingTop: [0, top], paddingBottom: [0, bottom] },
      { ...SPRING_SMOOTH, visualDuration: 0.42 },
    ).finished.then(() => {
      clear(target)
      done()
    })
  }

  function onLeave(el: Element, done: () => void) {
    const target = el as HTMLElement
    if (prefersReducedMotion()) return done()
    const { top, bottom } = paddings(target)
    target.style.overflow = 'hidden'
    animate(
      target,
      { height: [target.offsetHeight, 0], opacity: [1, 0], paddingTop: [top, 0], paddingBottom: [bottom, 0] },
      { duration: DURATION_S * 0.75, ease: EASE_OUT },
    ).finished.then(done)
  }

  return { onEnter, onLeave }
}
