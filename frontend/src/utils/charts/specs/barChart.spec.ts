import { describe, expect, it } from 'vitest'
import type { TimelineBucket } from '../../../services/analytics/interfaces/analytics.interface'
import { buildBarScale } from '../barChart'

const bucket = (start: string, totalExpense: number, totalIncome = 0): TimelineBucket => ({
  start,
  totalExpense,
  totalIncome,
  net: totalIncome - totalExpense,
  count: 1,
})

describe('buildBarScale', () => {
  it('sin ingresos en la escala, un sueldo grande no aplasta las barras de gasto', () => {
    const scale = buildBarScale([bucket('a', 100, 5000), bucket('b', 50)], false)

    expect(scale.bars[0].expenseRatio).toBeGreaterThan(0.85)
    expect(scale.bars[0].incomeRatio).toBe(0)
  })

  it('con ingresos en la escala, ambos comparten el maximo', () => {
    const scale = buildBarScale([bucket('a', 100, 400), bucket('b', 200, 0)], true)

    expect(scale.bars[0].incomeRatio).toBeGreaterThan(scale.bars[1].expenseRatio)
    expect(scale.bars[0].incomeRatio).toBeLessThanOrEqual(1)
  })

  it('el promedio deja afuera el ultimo periodo (en curso)', () => {
    const scale = buildBarScale([bucket('a', 100), bucket('b', 300), bucket('c', 10)], false)

    expect(scale.average).toBe(200)
  })

  it('sin movimientos no divide por cero', () => {
    const scale = buildBarScale([bucket('a', 0), bucket('b', 0)], true)

    expect(scale.bars.every((bar) => bar.expenseRatio === 0 && bar.incomeRatio === 0)).toBe(true)
    expect(scale.averageRatio).toBe(0)
  })
})
