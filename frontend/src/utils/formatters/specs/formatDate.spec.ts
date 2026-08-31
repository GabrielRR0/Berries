import { describe, expect, it } from 'vitest'
import { formatMonthYear } from '../formatDate'

describe('formatMonthYear', () => {
  it('formatea mes y año, con la primera letra en mayuscula', () => {
    expect(formatMonthYear(2026, 7)).toBe('Agosto de 2026')
  })

  it('funciona en el borde de diciembre/enero de años distintos', () => {
    expect(formatMonthYear(2026, 11)).toBe('Diciembre de 2026')
    expect(formatMonthYear(2027, 0)).toBe('Enero de 2027')
  })
})
