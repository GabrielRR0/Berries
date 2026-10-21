import type { Ref } from 'vue'
import { animate } from './motion'

// Anima un Ref numerico de vuelta a un valor de reposo con fisica de resorte
// real (posicion + velocidad inicial), via Motion One. Pensado para gestos de
// arrastre que el usuario suelta antes de cruzar un umbral de accion (ver
// BottomSheet.vue: soltar el swipe-to-dismiss sin llegar a los 120px de
// arrastre) - una transition de CSS no puede tomar una velocidad inicial
// real, solo interpola entre dos valores fijos, por eso este es el unico
// lugar de Berry que necesita JS para animar en vez de CSS.
export function useSpringBack(target: Ref<number>) {
  // Devuelve una promesa que resuelve cuando el resorte termina de asentarse
  // - BottomSheet.vue la espera para recien ahi soltar el modo "dragging"
  // (y con el, el inline style que pisa la transform frame a frame).
  function springBackTo(value: number, velocity = 0): Promise<unknown> {
    const controls = animate(target.value, value, {
      type: 'spring',
      stiffness: 500,
      damping: 35,
      velocity,
      onUpdate: (latest) => {
        target.value = latest
      },
    })
    return controls.finished
  }

  return { springBackTo }
}
