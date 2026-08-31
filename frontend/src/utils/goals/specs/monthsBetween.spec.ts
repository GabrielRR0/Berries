import { describe, expect, it } from 'vitest'
import { monthsBetween } from '../monthsBetween'

describe('monthsBetween', () => {
  it('calcula la diferencia de meses de calendario', () => {
    expect(monthsBetween(new Date(2026, 7, 28), new Date(2026, 10, 30))).toBe(3) // ago -> nov
  })

  it('nunca devuelve menos de 1', () => {
    expect(monthsBetween(new Date(2026, 7, 28), new Date(2026, 7, 29))).toBe(1) // mismo mes
    expect(monthsBetween(new Date(2026, 7, 28), new Date(2026, 0, 1))).toBe(1) // fecha ya pasada
  })

  it('cruza años correctamente', () => {
    expect(monthsBetween(new Date(2026, 10, 1), new Date(2027, 1, 1))).toBe(3) // nov 2026 -> feb 2027
  })
})
