import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Estado a nivel de modulo (ver useToast.ts) - cada test necesita su propia
// instancia fresca (import dinamico + resetModules), mismo criterio que
// useOnlineStatus.spec.ts.
describe('useToast', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('arranca sin ningun toast activo', async () => {
    const { useToast } = await import('../useToast')

    const { active } = useToast()

    expect(active.value).toBeNull()
  })

  it('showToast activa un toast con el texto y tono dados', async () => {
    const { useToast } = await import('../useToast')
    const { active, showToast } = useToast()

    showToast('Guardado sin conexión', 'info')

    expect(active.value?.text).toBe('Guardado sin conexión')
    expect(active.value?.tone).toBe('info')
  })

  it('el toast se auto-descarta despues de un rato', async () => {
    const { useToast } = await import('../useToast')
    const { active, showToast } = useToast()
    showToast('Se sincronizó')

    expect(active.value).not.toBeNull()
    vi.advanceTimersByTime(5000)

    expect(active.value).toBeNull()
  })

  it('si llegan varios toasts juntos, se muestran uno a la vez en orden (FIFO)', async () => {
    const { useToast } = await import('../useToast')
    const { active, showToast } = useToast()

    showToast('Primero')
    showToast('Segundo')

    expect(active.value?.text).toBe('Primero')

    vi.advanceTimersByTime(5000)
    expect(active.value?.text).toBe('Segundo')

    vi.advanceTimersByTime(5000)
    expect(active.value).toBeNull()
  })

  it('dos llamadas devuelven el mismo estado (singleton)', async () => {
    const { useToast } = await import('../useToast')
    const a = useToast()
    const b = useToast()

    a.showToast('Hola')

    expect(b.active.value?.text).toBe('Hola')
  })
})
