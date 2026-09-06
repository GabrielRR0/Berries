import { beforeEach, describe, expect, it, vi } from 'vitest'

// Estado a nivel de modulo (ver useOnlineStatus.ts) - cada test necesita su
// propia instancia fresca del modulo (import dinamico + resetModules), si no
// los listeners/valor inicial de un test se arrastrarian al siguiente.
function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value })
}

describe('useOnlineStatus', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('arranca reflejando navigator.onLine (true)', async () => {
    setNavigatorOnline(true)
    const { useOnlineStatus } = await import('../useOnlineStatus')

    const { isOnline } = useOnlineStatus()

    expect(isOnline.value).toBe(true)
  })

  it('arranca reflejando navigator.onLine (false)', async () => {
    setNavigatorOnline(false)
    const { useOnlineStatus } = await import('../useOnlineStatus')

    const { isOnline } = useOnlineStatus()

    expect(isOnline.value).toBe(false)
  })

  it('pasa a false cuando el navegador dispara "offline"', async () => {
    setNavigatorOnline(true)
    const { useOnlineStatus } = await import('../useOnlineStatus')
    const { isOnline } = useOnlineStatus()

    window.dispatchEvent(new Event('offline'))

    expect(isOnline.value).toBe(false)
  })

  it('pasa a true cuando el navegador dispara "online"', async () => {
    setNavigatorOnline(false)
    const { useOnlineStatus } = await import('../useOnlineStatus')
    const { isOnline } = useOnlineStatus()

    window.dispatchEvent(new Event('online'))

    expect(isOnline.value).toBe(true)
  })

  it('dos llamadas devuelven el MISMO ref (singleton, no uno por llamada)', async () => {
    setNavigatorOnline(true)
    const { useOnlineStatus } = await import('../useOnlineStatus')

    const a = useOnlineStatus()
    const b = useOnlineStatus()
    window.dispatchEvent(new Event('offline'))

    expect(a.isOnline.value).toBe(false)
    expect(b.isOnline.value).toBe(false)
  })
})
