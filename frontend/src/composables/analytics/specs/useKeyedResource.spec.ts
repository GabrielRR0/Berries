import { describe, expect, it, vi } from 'vitest'
import { useKeyedResource } from '../useKeyedResource'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useKeyedResource', () => {
  it('carga el dato y lo deja disponible', async () => {
    const resource = useKeyedResource<string>()

    await resource.load('a', async () => 'uno')

    expect(resource.data.value).toBe('uno')
    expect(resource.isLoading.value).toBe(false)
    expect(resource.error.value).toBeNull()
  })

  it('no repite la peticion de una clave que ya esta fresca, salvo con force', async () => {
    const resource = useKeyedResource<number>()
    const fetcher = vi.fn(async () => 1)

    await resource.load('a', fetcher)
    await resource.load('a', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)

    await resource.load('a', fetcher, { force: true })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('conserva el valor anterior mientras llega el de la nueva clave', async () => {
    const resource = useKeyedResource<string>()
    await resource.load('a', async () => 'viejo')
    const next = deferred<string>()

    const pending = resource.load('b', () => next.promise)

    expect(resource.data.value).toBe('viejo')
    expect(resource.isLoading.value).toBe(true)
    next.resolve('nuevo')
    await pending
    expect(resource.data.value).toBe('nuevo')
    expect(resource.isLoading.value).toBe(false)
  })

  it('descarta la respuesta tardia de una clave que el usuario ya dejo atras', async () => {
    const resource = useKeyedResource<string>()
    const slow = deferred<string>()

    const first = resource.load('a', () => slow.promise)
    await resource.load('b', async () => 'rapido')
    slow.resolve('lento')
    await first

    expect(resource.data.value).toBe('rapido')
    expect(resource.isLoading.value).toBe(false)
  })

  it('ante un error guarda el mensaje y no borra lo que ya se mostraba', async () => {
    const resource = useKeyedResource<string>()
    await resource.load('a', async () => 'ok')

    await resource.load('b', async () => {
      throw new Error('Se cayó la red')
    })

    expect(resource.error.value).toBe('Se cayó la red')
    expect(resource.data.value).toBe('ok')
    expect(resource.isLoading.value).toBe(false)
  })
})
