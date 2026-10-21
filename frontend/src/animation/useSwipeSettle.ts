import type { Ref } from 'vue'
import { animate } from './motion'

// Asienta el desplazamiento horizontal del paginador de secciones (commit al
// otro lado o vuelta a 0) con un resorte de Motion One que ARRANCA con la
// velocidad real del dedo al soltar - un tween de duracion fija ignora esa
// velocidad y se siente como si el gesto "frenara" de golpe al levantar el
// dedo. bounce:0 = criticamente amortiguado (sin rebote pasado el borde de la
// pagina). Consumido por useSectionPager.ts; tunear la sensacion aca solo.
const VISUAL_DURATION_S = 0.26
// Umbrales de reposo en px y px/s: sin esto el resorte seguia "terminando"
// el ultimo medio pixel ~400ms despues de que visualmente ya habia llegado
// (medido: 450-800ms en total) y el paginador quedaba ocupado ese tiempo.
const REST_DELTA_PX = 1
const REST_SPEED_PX_S = 40

export function useSwipeSettle(target: Ref<number>) {
  let controls: { stop: () => void } | null = null

  function settleTo(value: number, velocityPxPerSec = 0): Promise<void> {
    controls?.stop()
    const current = animate(target.value, value, {
      type: 'spring',
      bounce: 0,
      visualDuration: VISUAL_DURATION_S,
      restDelta: REST_DELTA_PX,
      restSpeed: REST_SPEED_PX_S,
      velocity: velocityPxPerSec,
      onUpdate: (latest) => {
        target.value = latest
      },
    })
    controls = current
    return current.finished.then(() => {
      if (controls === current) controls = null
      target.value = value
    })
  }

  function stop(): void {
    controls?.stop()
    controls = null
  }

  return { settleTo, stop }
}
