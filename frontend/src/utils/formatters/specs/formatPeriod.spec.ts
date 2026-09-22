import { describe, expect, it } from 'vitest'
import { toPeriodKey } from '../formatPeriod'

describe('toPeriodKey', () => {
  it('convierte un mes 0-indexado a la clave YYYY-MM que espera el backend', () => {
    expect(toPeriodKey(2026, 0)).toBe('2026-01')
    expect(toPeriodKey(2026, 8)).toBe('2026-09')
    expect(toPeriodKey(2026, 11)).toBe('2026-12')
  })
})
