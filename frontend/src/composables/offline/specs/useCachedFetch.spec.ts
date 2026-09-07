import { nextTick } from 'vue'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnlineStatus } from '../../connectivity/useOnlineStatus'
import { TransactionsApiError } from '../../../services/transactions/transactions.service'
import { useToast } from '../../toast/useToast'
import * as secureCache from '../../../utils/offlineCache/secureCache'
import { fetchWithOfflineCache } from '../useCachedFetch'

vi.mock('../../../utils/offlineCache/secureCache', () => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
}))

describe('fetchWithOfflineCache', () => {
  beforeAll(() => {
    // useToast es un singleton de modulo con su propio "uno a la vez" (ver
    // useToast.ts) - sin drenarlo entre tests, un toast que quedo activo en
    // un test tapa al que dispara el test siguiente (nunca llega a
    // promoverse de la cola a "active"). Fake timers desde el arranque de la
    // suite para poder drenarlo en el afterEach de abajo sin esperar 3.2s
    // reales por test.
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.advanceTimersByTime(10000)
  })

  beforeEach(async () => {
    vi.mocked(secureCache.readCache).mockReset()
    vi.mocked(secureCache.writeCache).mockReset().mockResolvedValue(undefined)
    // El watch() de useCachedFetch.ts flushea async (batchea mutaciones
    // sincronas seguidas en un solo job) - sin el await en el medio, un
    // false->true hecho de un tirón nunca se observa como cambio real (el
    // job solo corre una vez, comparando el valor ANTES de este bloque
    // contra el valor FINAL, ambos "true"). El await fuerza un flush real en
    // "false" antes de volver a "true", garantizando la transicion pase lo
    // que pase con el estado en que quedo el test anterior.
    useOnlineStatus().isOnline.value = false
    await nextTick()
    useOnlineStatus().isOnline.value = true
    await nextTick()
  })

  it('online + exito: llama fetchFn, onSuccess, y escribe cache si esta habilitada', async () => {
    const onSuccess = vi.fn()
    const onCacheFallback = vi.fn()
    const onRealError = vi.fn()
    const fetchFn = vi.fn().mockResolvedValue({ id: 1 })

    await fetchWithOfflineCache({
      isCachingEnabled: true,
      cacheKey: 'berry_cache_test',
      fetchFn,
      onSuccess,
      onCacheFallback,
      onRealError,
    })

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith({ id: 1 })
    expect(secureCache.writeCache).toHaveBeenCalledWith('berry_cache_test', { id: 1 })
    expect(onCacheFallback).not.toHaveBeenCalled()
    expect(onRealError).not.toHaveBeenCalled()
  })

  it('online + exito con cache deshabilitada: no escribe cache', async () => {
    await fetchWithOfflineCache({
      isCachingEnabled: false,
      cacheKey: 'berry_cache_test',
      fetchFn: vi.fn().mockResolvedValue({ id: 1 }),
      onSuccess: vi.fn(),
      onCacheFallback: vi.fn(),
      onRealError: vi.fn(),
    })

    expect(secureCache.writeCache).not.toHaveBeenCalled()
  })

  it('online + rechazo real del backend: llama onRealError, re-lanza, nunca cae a cache', async () => {
    const onCacheFallback = vi.fn()
    const onRealError = vi.fn()

    await expect(
      fetchWithOfflineCache({
        isCachingEnabled: true,
        cacheKey: 'berry_cache_test',
        fetchFn: vi.fn().mockRejectedValue(new TransactionsApiError('Rechazado', 400)),
        onSuccess: vi.fn(),
        onCacheFallback,
        onRealError,
      }),
    ).rejects.toThrow('Rechazado')

    expect(onRealError).toHaveBeenCalledWith('Rechazado')
    expect(onCacheFallback).not.toHaveBeenCalled()
  })

  it('online + falla de conexion, cache habilitada y con datos: usa la cache, avisa "mostrando datos guardados"', async () => {
    vi.mocked(secureCache.readCache).mockResolvedValue({ id: 99 })
    const onCacheFallback = vi.fn()

    await fetchWithOfflineCache({
      isCachingEnabled: true,
      cacheKey: 'berry_cache_test',
      fetchFn: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      onSuccess: vi.fn(),
      onCacheFallback,
      onRealError: vi.fn(),
    })

    expect(onCacheFallback).toHaveBeenCalledWith({ id: 99 })
    expect(useToast().active.value?.text).toContain('mostrando datos guardados')
  })

  it('online + falla de conexion, cache habilitada pero sin datos: no llama onCacheFallback, avisa que no hay datos guardados', async () => {
    vi.mocked(secureCache.readCache).mockResolvedValue(null)
    const onCacheFallback = vi.fn()

    await fetchWithOfflineCache({
      isCachingEnabled: true,
      cacheKey: 'berry_cache_test',
      fetchFn: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      onSuccess: vi.fn(),
      onCacheFallback,
      onRealError: vi.fn(),
    })

    expect(onCacheFallback).not.toHaveBeenCalled()
    expect(useToast().active.value?.text).toContain('todavía no hay datos guardados')
  })

  it('online + falla de conexion, cache deshabilitada: avisa que active el modo offline en Ajustes', async () => {
    await fetchWithOfflineCache({
      isCachingEnabled: false,
      cacheKey: 'berry_cache_test',
      fetchFn: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      onSuccess: vi.fn(),
      onCacheFallback: vi.fn(),
      onRealError: vi.fn(),
    })

    expect(secureCache.readCache).not.toHaveBeenCalled()
    expect(useToast().active.value?.text).toContain('Ajustes')
  })

  it('offline directo: nunca llama fetchFn, va directo al fallback de cache', async () => {
    useOnlineStatus().isOnline.value = false
    vi.mocked(secureCache.readCache).mockResolvedValue({ id: 5 })
    const fetchFn = vi.fn()
    const onCacheFallback = vi.fn()

    await fetchWithOfflineCache({
      isCachingEnabled: true,
      cacheKey: 'berry_cache_test',
      fetchFn,
      onSuccess: vi.fn(),
      onCacheFallback,
      onRealError: vi.fn(),
    })

    expect(fetchFn).not.toHaveBeenCalled()
    expect(onCacheFallback).toHaveBeenCalledWith({ id: 5 })
  })

  it('dedupe: dos fallbacks seguidos en la misma racha offline muestran un solo toast', async () => {
    useOnlineStatus().isOnline.value = false
    vi.mocked(secureCache.readCache).mockResolvedValue({ id: 1 })

    await fetchWithOfflineCache({
      isCachingEnabled: true,
      cacheKey: 'berry_cache_a',
      fetchFn: vi.fn(),
      onSuccess: vi.fn(),
      onCacheFallback: vi.fn(),
      onRealError: vi.fn(),
    })
    const firstToastId = useToast().active.value?.id

    await fetchWithOfflineCache({
      isCachingEnabled: true,
      cacheKey: 'berry_cache_b',
      fetchFn: vi.fn(),
      onSuccess: vi.fn(),
      onCacheFallback: vi.fn(),
      onRealError: vi.fn(),
    })

    // Sigue siendo el MISMO toast (nunca se disparo uno nuevo para el segundo fallback).
    expect(useToast().active.value?.id).toBe(firstToastId)
  })

  it('al volver la señal, el dedupe se resetea (un fallback offline nuevo vuelve a avisar)', async () => {
    useOnlineStatus().isOnline.value = false
    vi.mocked(secureCache.readCache).mockResolvedValue({ id: 1 })
    await fetchWithOfflineCache({
      isCachingEnabled: true,
      cacheKey: 'berry_cache_a',
      fetchFn: vi.fn(),
      onSuccess: vi.fn(),
      onCacheFallback: vi.fn(),
      onRealError: vi.fn(),
    })
    const firstToastId = useToast().active.value?.id
    // El primer toast tiene que terminar de mostrarse (useToast.ts es "uno a
    // la vez") para que el segundo pueda promoverse a "active" - si no,
    // aunque el dedupe SI dispare un showToast nuevo, quedaria encolado
    // detras del primero en vez de reemplazarlo.
    vi.advanceTimersByTime(3300)

    useOnlineStatus().isOnline.value = true
    await nextTick()
    useOnlineStatus().isOnline.value = false
    await fetchWithOfflineCache({
      isCachingEnabled: true,
      cacheKey: 'berry_cache_b',
      fetchFn: vi.fn(),
      onSuccess: vi.fn(),
      onCacheFallback: vi.fn(),
      onRealError: vi.fn(),
    })

    expect(useToast().active.value?.text).toBeTruthy()
    expect(useToast().active.value?.id).not.toBe(firstToastId)
  })
})
