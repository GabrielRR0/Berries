import { describe, expect, it } from 'vitest'
import { buildPace } from '../pace'

describe('buildPace', () => {
  it('proyecta el cierre y compara contra el ritmo esperado', () => {
    const pace = buildPace({ spent: 450, elapsedDays: 9, daysInMonth: 30, priorExpenses: [1500, 1400, 1600] })

    expect(pace.average).toBe(1500)
    expect(pace.expected).toBe(450)
    expect(pace.projected).toBe(1500)
    expect(pace.overPace).toBe(0)
    expect(pace.markerRatio).toBeCloseTo(0.3)
    expect(pace.fillRatio).toBeCloseTo(0.3)
  })

  it('sobre el ritmo: el exceso y la diferencia proyectada son positivos', () => {
    const pace = buildPace({ spent: 600, elapsedDays: 9, daysInMonth: 30, priorExpenses: [1500] })

    expect(pace.overPace).toBe(150)
    expect(pace.projected).toBeCloseTo(2000)
    expect(pace.projectedDiff).toBeCloseTo(500)
  })

  it('ignora meses sin gasto al promediar y no inventa un promedio sin historial', () => {
    expect(buildPace({ spent: 100, elapsedDays: 5, daysInMonth: 30, priorExpenses: [0, 1000, 0] }).average).toBe(1000)

    const empty = buildPace({ spent: 100, elapsedDays: 5, daysInMonth: 30, priorExpenses: [] })
    expect(empty.hasAverage).toBe(false)
    expect(empty.fillRatio).toBe(0)
  })

  it('un mes cerrado proyecta exactamente lo gastado y la barra no pasa de llena', () => {
    const pace = buildPace({ spent: 2000, elapsedDays: 30, daysInMonth: 30, priorExpenses: [1000] })

    expect(pace.isClosed).toBe(true)
    expect(pace.projected).toBe(2000)
    expect(pace.fillRatio).toBe(1)
  })
})
