import { markRaw, shallowReactive, type Component } from 'vue'
import type { RouteRecordNormalized } from 'vue-router'

// Resuelve y precarga el codigo (chunk) de cada seccion del paginador. Todas
// las rutas se declaran con `component: () => import(...)`: si el chunk recien
// se pide al empezar a arrastrar, la pagina vecina queda vacia (negra) hasta
// que termina de bajar - en dev por el tunel eso son segundos. Aca se resuelve
// a un componente sincrono ANTES de que haga falta mostrarlo.
export interface PagerSection {
  name: string
  path: string
  order: number
  loader: () => Promise<unknown>
}

export function sectionsFromRoutes(routes: RouteRecordNormalized[]): PagerSection[] {
  return routes
    .filter((r) => typeof r.meta.order === 'number' && typeof r.components?.default === 'function')
    .map((r) => ({
      name: String(r.name),
      path: r.path,
      order: r.meta.order as number,
      loader: r.components!.default as () => Promise<unknown>,
    }))
    .sort((a, b) => a.order - b.order)
}

export function useSectionComponents(sections: PagerSection[]) {
  const resolved = shallowReactive(new Map<string, Component>())
  const pending = new Map<string, Promise<void>>()

  function ensureResolved(section: PagerSection): Promise<void> {
    if (resolved.has(section.name)) return Promise.resolve()
    let promise = pending.get(section.name)
    if (!promise) {
      promise = section.loader().then((mod) => {
        const component = (mod as { default?: Component }).default ?? (mod as Component)
        resolved.set(section.name, markRaw(component))
      })
      pending.set(section.name, promise)
    }
    return promise
  }

  // Precarga el resto de las secciones cuando el navegador esta libre, en
  // orden de cercania a la activa - un tap en la barra hacia una seccion
  // lejana ya no tiene que esperar la descarga.
  function preloadAll(fromIndex: number): void {
    const byDistance = sections
      .map((section, index) => ({ section, distance: Math.abs(index - fromIndex) }))
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.section)

    const idle: (cb: () => void) => void =
      'requestIdleCallback' in window ? (cb) => window.requestIdleCallback(cb) : (cb) => setTimeout(cb, 200)

    const next = (queue: PagerSection[]) => {
      const [head, ...rest] = queue
      if (!head) return
      idle(() => {
        ensureResolved(head)
          .catch(() => {})
          .finally(() => next(rest))
      })
    }
    next(byDistance)
  }

  return { resolved, ensureResolved, preloadAll }
}
