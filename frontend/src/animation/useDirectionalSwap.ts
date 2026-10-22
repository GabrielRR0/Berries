import { watch, type Ref } from 'vue'
import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'
import { SPRING_SMOOTH } from './springs'

// Cambio de contenido "con direccion" cuando el valor de `stamp` sube o baja
// (ej. mes anterior / siguiente), como el empuje de pagina de iOS: lo que se ve
// ahora SALE deslizando hacia un lado mientras lo nuevo ENTRA desde el otro, a la
// vez. Para que el arranque sea continuo (sin que el contenido desaparezca de
// golpe antes de reaparecer) se deja una COPIA del contenido viejo en su lugar
// exacto que se desvanece y se va; el contenido real entra desde el lado opuesto.
// Adelante entra desde la derecha, atras desde la izquierda. Poco recorrido, un
// desenfoque minimo y sin rebote: se siente nativo de principio a fin.
//
// Corre con flush "pre": el DOM todavia es el del valor anterior, que es justo lo
// que hay que copiar.
const SOFT_EASE = [0.32, 0.72, 0, 1] as const
const OUT_S = 0.4
const BLUR_PX = 4

export interface DirectionalSwapOptions {
  selector: string
  distance?: number
  step?: number
}

// Copia de `part` pegada exactamente donde esta ahora. El padre pasa a
// position:relative mientras dura la copia (se restaura al terminar).
function leaveGhost(part: HTMLElement): { ghost: HTMLElement; restore: () => void } | null {
  const parent = part.parentElement
  if (!parent) return null
  const previousPosition = parent.style.position
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative'

  const ghost = part.cloneNode(true) as HTMLElement
  ghost.removeAttribute('data-month-part')
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, {
    position: 'absolute',
    left: `${part.offsetLeft}px`,
    top: `${part.offsetTop}px`,
    width: `${part.offsetWidth}px`,
    height: `${part.offsetHeight}px`,
    margin: '0',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  })
  parent.appendChild(ghost)
  return { ghost, restore: () => (parent.style.position = previousPosition) }
}

export function useDirectionalSwap(
  container: Ref<HTMLElement | null>,
  stamp: () => number | undefined,
  { selector, distance = 28, step = 0.045 }: DirectionalSwapOptions,
) {
  let previous = stamp()

  watch(
    stamp,
    (next) => {
      const direction = previous === undefined || next === undefined || next >= previous ? 1 : -1
      previous = next
      const root = container.value
      if (!root || prefersReducedMotion()) return
      const parts = Array.from(root.querySelectorAll<HTMLElement>(selector))
      if (parts.length === 0) return

      parts.forEach((part, index) => {
        const delay = index * step
        const left = leaveGhost(part)
        if (left) {
          animate(
            left.ghost,
            { x: -direction * distance, opacity: 0, filter: `blur(${BLUR_PX}px)` },
            { duration: OUT_S, delay, ease: SOFT_EASE },
          ).finished.then(() => {
            left.ghost.remove()
            left.restore()
          })
        }

        const fade = animate(
          part,
          { opacity: [0, 1], filter: [`blur(${BLUR_PX}px)`, 'blur(0px)'] },
          { duration: 0.45, delay: delay + 0.04, ease: SOFT_EASE },
        )
        const slide = animate(part, { x: [direction * distance, 0] }, { ...SPRING_SMOOTH, delay })
        Promise.all([fade.finished, slide.finished]).then(() => {
          part.style.opacity = ''
          part.style.transform = ''
          part.style.filter = ''
        })
      })
    },
    { flush: 'pre' },
  )
}
