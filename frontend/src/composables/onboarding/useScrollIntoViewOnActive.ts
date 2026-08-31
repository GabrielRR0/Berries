import { nextTick, watch, type Ref } from 'vue'

// El tour guiado de Inicio (useOnboardingTour.ts) puede señalar un elemento
// que este fuera de la vista actual (ej. las boxes de Ingresos/Gastos estan
// mas abajo que los accesos rapidos, pero su paso viene ANTES en el orden
// del tour) - pedido explicito del usuario: cuando el paso activo apunta a
// algo fuera de pantalla, hay que scrollear hasta ahi, no dejar la caja
// flotante aparecer "invisible" mas abajo.
export function useScrollIntoViewOnActive(target: Ref<HTMLElement | null>, isActive: Ref<boolean>) {
  watch(isActive, async (active) => {
    if (!active) return
    await nextTick()
    target.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}
