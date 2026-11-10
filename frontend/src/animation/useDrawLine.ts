import { nextTick, onMounted, watch, type Ref } from 'vue'
import { drawPath } from './drawPath'
import { animate } from './motion'
import { prefersReducedMotion } from './prefersReducedMotion'

// Dibuja la linea de un grafico de punta a punta y, cuando termina, hace aparecer el
// relleno debajo. Se repite cada vez que cambian los datos (`source`), asi la curva "se
// vuelve a trazar" al cambiar de mes. Con "menos movimiento" no anima nada.
export function useDrawLine(line: Ref<SVGPathElement | null>, area: Ref<SVGPathElement | null>, source: () => unknown) {
  function run() {
    const path = line.value
    if (!path) return
    const fill = area.value
    if (fill && !prefersReducedMotion()) fill.style.opacity = '0'
    drawPath(path).then(() => {
      if (!fill || prefersReducedMotion()) return
      animate(fill, { opacity: 1 }, { duration: 0.5 })
    })
  }

  onMounted(run)
  // La linea suele aparecer despues de montar el componente (cuando llegan los datos).
  watch(line, (element) => {
    if (element) run()
  })
  watch(source, async () => {
    await nextTick()
    run()
  })
}
