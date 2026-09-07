import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom no implementa IndexedDB - stub minimo escrito a mano (sin libreria),
// con solo lo que secureCache.ts realmente usa: open/createObjectStore/
// transaction/objectStore/put/get.
class FakeIDBRequest<T> {
  result: T | undefined
  error: unknown = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null

  succeed(result: T) {
    this.result = result
    queueMicrotask(() => this.onsuccess?.())
  }
}

class FakeIDBObjectStore {
  private data: Map<string, unknown>

  constructor(data: Map<string, unknown>) {
    this.data = data
  }

  put(value: unknown, key: string): FakeIDBRequest<undefined> {
    this.data.set(key, value)
    const request = new FakeIDBRequest<undefined>()
    request.succeed(undefined)
    return request
  }

  get(key: string): FakeIDBRequest<unknown> {
    const request = new FakeIDBRequest<unknown>()
    request.succeed(this.data.get(key))
    return request
  }
}

class FakeIDBTransaction {
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null
  private store: FakeIDBObjectStore

  constructor(store: FakeIDBObjectStore) {
    this.store = store
    queueMicrotask(() => this.oncomplete?.())
  }

  objectStore(): FakeIDBObjectStore {
    return this.store
  }
}

class FakeIDBDatabase {
  private stores = new Map<string, Map<string, unknown>>()

  createObjectStore(name: string) {
    this.stores.set(name, new Map())
  }

  transaction(storeName: string): FakeIDBTransaction {
    const data = this.stores.get(storeName) ?? new Map()
    this.stores.set(storeName, data)
    return new FakeIDBTransaction(new FakeIDBObjectStore(data))
  }
}

function installFakeIndexedDB() {
  const databases = new Map<string, FakeIDBDatabase>()
  vi.stubGlobal('indexedDB', {
    open(name: string): FakeIDBRequest<FakeIDBDatabase> & { onupgradeneeded: (() => void) | null } {
      const request = new FakeIDBRequest<FakeIDBDatabase>() as FakeIDBRequest<FakeIDBDatabase> & {
        onupgradeneeded: (() => void) | null
      }
      request.onupgradeneeded = null
      const isNew = !databases.has(name)
      const db = databases.get(name) ?? new FakeIDBDatabase()
      databases.set(name, db)
      request.result = db
      queueMicrotask(() => {
        if (isNew) request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    },
  })
}

describe('secureCache', () => {
  beforeEach(() => {
    localStorage.clear()
    installFakeIndexedDB()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('guarda un valor y lo recupera igual (round-trip)', async () => {
    const { writeCache, readCache } = await import('../secureCache')

    await writeCache('berry_cache_test', { hello: 'world', amount: 42 })
    const result = await readCache<{ hello: string; amount: number }>('berry_cache_test')

    expect(result).toEqual({ hello: 'world', amount: 42 })
  })

  it('el valor guardado en localStorage no es el JSON en texto plano (esta cifrado)', async () => {
    const { writeCache } = await import('../secureCache')

    await writeCache('berry_cache_test', { secret: 'balance-1000' })
    const raw = localStorage.getItem('berry_cache_test')

    expect(raw).toBeTruthy()
    expect(raw).not.toContain('secret')
    expect(raw).not.toContain('balance-1000')
  })

  it('devuelve null si no hay nada guardado para ese key', async () => {
    const { readCache } = await import('../secureCache')

    const result = await readCache('berry_cache_nunca_guardado')

    expect(result).toBeNull()
  })

  it('devuelve null (en vez de tirar) si el valor guardado esta corrupto', async () => {
    const { readCache } = await import('../secureCache')
    localStorage.setItem('berry_cache_test', 'esto-no-es-base64-cifrado-valido!!')

    const result = await readCache('berry_cache_test')

    expect(result).toBeNull()
  })

  it('devuelve null (en vez de tirar) si IndexedDB no esta disponible', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const { readCache, writeCache } = await import('../secureCache')

    await writeCache('berry_cache_test', { a: 1 })
    const result = await readCache('berry_cache_test')

    expect(result).toBeNull()
  })

  it('clearCache borra un key puntual', async () => {
    const { writeCache, readCache, clearCache } = await import('../secureCache')
    await writeCache('berry_cache_test', { a: 1 })

    clearCache('berry_cache_test')

    expect(await readCache('berry_cache_test')).toBeNull()
    expect(localStorage.getItem('berry_cache_test')).toBeNull()
  })

  it('clearCacheByPrefix borra todos los keys que empiezan con ese prefijo, y ninguno mas', async () => {
    const { writeCache, clearCacheByPrefix } = await import('../secureCache')
    await writeCache('berry_cache_goals_list', { a: 1 })
    await writeCache('berry_cache_goals_summary', { b: 2 })
    await writeCache('berry_cache_wallets', { c: 3 })

    clearCacheByPrefix('berry_cache_goals')

    expect(localStorage.getItem('berry_cache_goals_list')).toBeNull()
    expect(localStorage.getItem('berry_cache_goals_summary')).toBeNull()
    expect(localStorage.getItem('berry_cache_wallets')).not.toBeNull()
  })

  it('dos escrituras distintas reusan la MISMA clave (la clave sobrevive entre llamadas)', async () => {
    const { writeCache, readCache } = await import('../secureCache')

    await writeCache('berry_cache_a', { value: 'uno' })
    await writeCache('berry_cache_b', { value: 'dos' })

    expect(await readCache('berry_cache_a')).toEqual({ value: 'uno' })
    expect(await readCache('berry_cache_b')).toEqual({ value: 'dos' })
  })
})
