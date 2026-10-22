import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'
import { SPRING_SMOOTH } from './springs'

// Hooks para <TransitionGroup :css="false" appear> de una lista: cada fila
// entra con fade + subida escalonada segun su `data-order` (posicion en la
// lista completa, tope STAGGER_CAP para que una lista larga no tarde en
// terminar) y la que se elimina desliza hacia el costado y se desvanece. El
// reacomodo de las demas sigue siendo un FLIP por CSS (clase `-move`).
const ENTER_DURATION_S = 0.4
const LEAVE_DURATION_S = 0.25
const STEP_S = 0.045
const STAGGER_CAP = 8
const RISE_PX = 12
const SLIDE_PX = 28
const EASE_OUT = [0.16, 1, 0.3, 1] as const

export function useListStaggerTransition() {
  function onBeforeEnter(el: Element) {
    if (!prefersReducedMotion()) (el as HTMLElement).style.opacity = '0'
  }

  function onEnter(el: Element, done: () => void) {
    const row = el as HTMLElement
    if (prefersReducedMotion()) return done()
    const order = Math.min(Number(row.dataset.order ?? 0), STAGGER_CAP)
    const delay = order * STEP_S
    const fade = animate(row, { opacity: [0, 1] }, { duration: ENTER_DURATION_S, delay, ease: EASE_OUT })
    const rise = animate(row, { y: [RISE_PX, 0], scale: [0.985, 1] }, { ...SPRING_SMOOTH, delay })
    Promise.all([fade.finished, rise.finished]).then(() => {
      row.style.opacity = ''
      row.style.transform = ''
      done()
    })
  }

  // Se saca de flujo (absolute) antes de animar para que las demas filas
  // puedan reacomodarse mientras esta todavia se ve deslizando afuera.
  function onLeave(el: Element, done: () => void) {
    const row = el as HTMLElement
    if (prefersReducedMotion()) return done()
    row.style.position = 'absolute'
    row.style.top = `${row.offsetTop}px`
    row.style.width = `${row.offsetWidth}px`
    animate(row, { opacity: 0, x: SLIDE_PX, scale: 0.96 }, { duration: LEAVE_DURATION_S, ease: EASE_OUT }).finished.then(done)
  }

  return { onBeforeEnter, onEnter, onLeave }
}
