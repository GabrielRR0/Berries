import { describe, expect, it } from 'vitest'
import { useOccurredAtField } from '../useOccurredAtField'

describe('useOccurredAtField', () => {
  it('al editar arranca en la fecha y hora propias (en hora local)', () => {
    const original = new Date(2026, 0, 15, 8, 5, 42)

    const field = useOccurredAtField(original.toISOString())

    expect(field.date.value).toBe('2026-01-15')
    expect(field.time.value).toBe('08:05')
  })

  it('sin tocar nada devuelve el mismo instante (conserva hora y segundos)', () => {
    const original = new Date(2026, 0, 15, 8, 5, 42)

    const field = useOccurredAtField(original.toISOString())

    expect(field.buildOccurredAt()).toBe(original.toISOString())
  })

  it('cambiar la hora cambia solo la hora, no la fecha', () => {
    const field = useOccurredAtField(new Date(2026, 0, 15, 8, 5, 42).toISOString())

    field.time.value = '21:30'

    expect(field.buildOccurredAt()).toBe(new Date(2026, 0, 15, 21, 30, 42).toISOString())
  })

  it('cambiar la fecha conserva la hora', () => {
    const field = useOccurredAtField(new Date(2026, 0, 15, 8, 5, 0).toISOString())

    field.date.value = '2026-01-10'

    expect(field.buildOccurredAt()).toBe(new Date(2026, 0, 10, 8, 5, 0).toISOString())
  })

  it('al crear arranca en hoy y la hora actual', () => {
    const before = new Date()
    const field = useOccurredAtField()

    expect(field.date.value).toBe(field.maxDate)
    expect(field.time.value).toMatch(/^\d{2}:\d{2}$/)
    expect(Math.abs(new Date(field.buildOccurredAt()).getTime() - before.getTime())).toBeLessThan(120_000)
  })
})
