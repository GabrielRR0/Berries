import { ref, type Ref } from 'vue'

// Un dato remoto que depende de una clave (mes, granularidad...). Conserva el valor anterior
// mientras llega el nuevo (la pantalla no parpadea ni se vacia al cambiar de mes), guarda en
// memoria lo ya pedido por unos minutos y descarta las respuestas que llegan tarde si el
// usuario ya cambio de clave.
const FRESH_MS = 2 * 60 * 1000

export interface KeyedResource<T> {
  data: Ref<T | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  load: (key: string, fetcher: () => Promise<T>, options?: { force?: boolean }) => Promise<void>
}

export function useKeyedResource<T>(): KeyedResource<T> {
  const data = ref(null) as Ref<T | null>
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const cache = new Map<string, { at: number; value: T }>()
  let latestRequest = 0

  async function load(key: string, fetcher: () => Promise<T>, options: { force?: boolean } = {}): Promise<void> {
    const cached = cache.get(key)
    if (cached && !options.force && Date.now() - cached.at < FRESH_MS) {
      latestRequest++
      data.value = cached.value
      isLoading.value = false
      error.value = null
      return
    }

    const request = ++latestRequest
    isLoading.value = true
    error.value = null
    try {
      const value = await fetcher()
      cache.set(key, { at: Date.now(), value })
      if (request === latestRequest) data.value = value
    } catch (err) {
      if (request === latestRequest) error.value = err instanceof Error ? err.message : 'No se pudieron cargar los datos.'
    } finally {
      if (request === latestRequest) isLoading.value = false
    }
  }

  return { data, isLoading, error, load }
}
