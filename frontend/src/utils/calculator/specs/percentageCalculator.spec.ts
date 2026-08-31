import { describe, expect, it } from 'vitest'
import { amountAsPercentOfTotal, percentOfAmount } from '../percentageCalculator'

describe('percentOfAmount', () => {
  it('calcula el X% de un monto (ej. propina del 10% sobre $45)', () => {
    expect(percentOfAmount(45, 10)).toBeCloseTo(4.5, 5)
  })

  it('devuelve null con inputs no numericos', () => {
    expect(percentOfAmount(Number.NaN, 10)).toBeNull()
  })
})

describe('amountAsPercentOfTotal', () => {
  it('calcula que % representa un monto de un total', () => {
    expect(amountAsPercentOfTotal(120, 500)).toBeCloseTo(24, 5)
  })

  it('devuelve null si el total es cero (division por cero)', () => {
    expect(amountAsPercentOfTotal(120, 0)).toBeNull()
  })
})
