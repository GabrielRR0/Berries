import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'

// Animacion "tipo Apple" de un panel que NACE de un boton: el panel arranca
// del tamaño y la posicion del boton (escala + traslado hasta el centro del
// boton) y se expande con un resorte hasta su lugar final; al cerrar hace el
// camino inverso y se vuelve a meter en el boton. Sin origen (ej. se abre
// desde otro lado) cae a una subida suave desde abajo. Con "menos
// movimiento" aparece/desaparece con un fundido corto.
const OPEN_SPRING = { type: 'spring', bounce: 0.18, visualDuration: 0.55 } as const
const MIN_SCALE = 0.12
const EXPANDED = 'translate(0px, 0px) scale(1)'

function collapsedTransform(panel: HTMLElement, origin: DOMRect | null): string {
  if (!origin) return 'translate(0px, 48px) scale(0.96)'
  const target = panel.getBoundingClientRect()
  const dx = origin.left + origin.width / 2 - (target.left + target.width / 2)
  const dy = origin.top + origin.height / 2 - (target.top + target.height / 2)
  const scale = Math.max(origin.width / target.width, MIN_SCALE)
  return `translate(${dx}px, ${dy}px) scale(${scale})`
}

// startOffsetY (solo al cerrar): cuanto bajo el panel el dedo antes de soltarlo
// con el gesto de arrastrar - el cierre arranca desde ahi, sin saltar de
// vuelta a su lugar de reposo.
export function morphFromOrigin(
  panel: HTMLElement,
  origin: DOMRect | null,
  direction: 'in' | 'out',
  startOffsetY = 0,
): Promise<void> {
  if (prefersReducedMotion()) {
    return animate(panel, { opacity: direction === 'in' ? [0, 1] : [1, 0] }, { duration: 0.15 }).finished.then(
      () => undefined,
    )
  }

  const collapsed = collapsedTransform(panel, origin)
  // El contenido aparece un instante despues de que el panel ya crecio un
  // poco (y se va antes de que se encoja), para que nunca se vea comprimido
  // dentro del boton.
  const content = panel.querySelector<HTMLElement>('[data-morph-content]')

  if (direction === 'in') {
    if (content) animate(content, { opacity: [0, 1] }, { duration: 0.25, delay: 0.14 })
    animate(panel, { opacity: [0, 1] }, { duration: 0.12 })
    return animate(panel, { transform: [collapsed, EXPANDED] }, OPEN_SPRING).finished.then(() => {
      panel.style.transform = ''
    })
  }

  const from = startOffsetY > 0 ? `translate(0px, ${startOffsetY}px) scale(1)` : EXPANDED
  if (content) animate(content, { opacity: [1, 0] }, { duration: 0.12 })
  animate(panel, { opacity: [1, 0] }, { duration: 0.18, delay: 0.14 })
  return animate(panel, { transform: [from, collapsed] }, { duration: 0.32, ease: [0.4, 0, 0.2, 1] }).finished.then(
    () => undefined,
  )
}
