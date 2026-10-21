import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'

// Dibuja un trazo SVG de punta a punta (linea de un grafico) con Motion:
// anima stroke-dashoffset desde el largo total hasta 0. Devuelve una promesa
// que resuelve al terminar, para encadenar el relleno/punto del grafico.
// Con "menos movimiento" deja el trazo completo al instante.
export function drawPath(path: SVGPathElement, durationSeconds = 1.2): Promise<void> {
  // Entornos sin geometria SVG (jsdom en los tests) no pueden medir el trazo:
  // se deja tal cual, ya dibujado.
  if (typeof path.getTotalLength !== 'function') return Promise.resolve()

  const length = path.getTotalLength()
  path.style.strokeDasharray = String(length)

  if (prefersReducedMotion()) {
    path.style.strokeDashoffset = '0'
    return Promise.resolve()
  }

  path.style.strokeDashoffset = String(length)
  return animate(path, { strokeDashoffset: [length, 0] }, { duration: durationSeconds, ease: [0.4, 0, 0.2, 1] })
    .finished.then(() => undefined)
}
