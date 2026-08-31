import { describe, expect, it } from 'vitest'
import { calculateInstallmentPlan } from '../installmentCalculator'

describe('calculateInstallmentPlan', () => {
  it('sin interes, divide el monto en partes iguales', () => {
    const result = calculateInstallmentPlan(1200, 12)
    expect(result).toEqual({ installmentAmount: 100, totalPaid: 1200, totalInterest: 0 })
  })

  it('con interes, aplica la formula de amortizacion (cuota fija)', () => {
    // $1000 a 12 meses al 12% anual (1% mensual) - valor de referencia
    // calculado con la formula estandar de cuota fija.
    const result = calculateInstallmentPlan(1000, 12, 12)!
    expect(result.installmentAmount).toBeCloseTo(88.85, 2)
    expect(result.totalPaid).toBeCloseTo(1066.19, 1)
    expect(result.totalInterest).toBeCloseTo(66.19, 1)
  })

  it('la cuota con interes es mayor a la cuota sin interes para el mismo monto/plazo', () => {
    const withoutInterest = calculateInstallmentPlan(1000, 12, 0)!
    const withInterest = calculateInstallmentPlan(1000, 12, 12)!
    expect(withInterest.installmentAmount).toBeGreaterThan(withoutInterest.installmentAmount)
  })

  it('devuelve null para inputs invalidos (monto o cuotas no positivos)', () => {
    expect(calculateInstallmentPlan(0, 12)).toBeNull()
    expect(calculateInstallmentPlan(-100, 12)).toBeNull()
    expect(calculateInstallmentPlan(1000, 0)).toBeNull()
    expect(calculateInstallmentPlan(1000, -3)).toBeNull()
  })
})
