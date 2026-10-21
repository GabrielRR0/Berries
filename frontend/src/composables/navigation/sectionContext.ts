import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

// Contexto que SectionPane.vue le da a la pagina que envuelve: su propio
// contenedor de scroll (cada seccion scrollea por separado, patron ion-content)
// y si es la pagina activa del paginador o una vecina pre-montada fuera de
// pantalla. Fuera del paginador (pantallas sin meta.order, specs) no hay
// provider: el scroll cae a window y la pagina se considera activa.
const SCROLLER_KEY: InjectionKey<Ref<HTMLElement | null>> = Symbol('section-scroller')
const ACTIVE_KEY: InjectionKey<Readonly<Ref<boolean>>> = Symbol('section-active')

export function provideSectionContext(scroller: Ref<HTMLElement | null>, active: Readonly<Ref<boolean>>): void {
  provide(SCROLLER_KEY, scroller)
  provide(ACTIVE_KEY, active)
}

export function useSectionScroller(): Ref<HTMLElement | null> | null {
  return inject(SCROLLER_KEY, null)
}

export function useSectionActive(): Readonly<Ref<boolean>> {
  return inject(ACTIVE_KEY, ref(true))
}
