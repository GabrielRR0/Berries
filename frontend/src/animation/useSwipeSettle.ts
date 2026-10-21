import type { Ref } from 'vue'
import { animate } from './motion'

// Anima el translateX final de un arrastre horizontal (commit hasta el otro
// lado, o spring-back a 0) via Motion One - mismo criterio que
// useSpringBack.ts (ver README.md de esta carpeta): consumido por
// useSwipeNavigation.ts para terminar el gesto de deslizar entre secciones
// (Inicio/Movimientos/etc.) a mano, antes de cambiar de ruta. Queda en su
// propio composable (no un rAF+transitionend a mano adentro de
// useSwipeNavigation.ts) para que la curva/duracion del asentamiento se pueda
// tunear aca solo, sin tocar la logica de deteccion del gesto.
export function useSwipeSettle(target: Ref<number>) {
  // easing/duration calcados de --ease-slide/--duration-base (style.css) -
  // misma sensacion que el resto de las transiciones de pagina de Berry.
  function settleTo(value: number, duration = 0.3): Promise<unknown> {
    const controls = animate(target.value, value, {
      type: 'tween',
      duration,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (latest) => {
        target.value = latest
      },
    })
    return controls.finished
  }

  return { settleTo }
}
