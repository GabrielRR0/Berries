import { describe, expect, it } from 'vitest'
import { formatMonthName, formatMonthYear, formatRelativeDay } from '../formatDate'

describe('formatMonthYear', () => {
  it('formatea mes y año, con la primera letra en mayuscula', () => {
    expect(formatMonthYear(2026, 7)).toBe('Agosto de 2026')
  })

  it('funciona en el borde de diciembre/enero de años distintos', () => {
    expect(formatMonthYear(2026, 11)).toBe('Diciembre de 2026')
    expect(formatMonthYear(2027, 0)).toBe('Enero de 2027')
  })
})

describe('formatMonthName', () => {
  it('devuelve solo el mes, con la primera letra en mayuscula', () => {
    expect(formatMonthName(new Date(2026, 9, 21))).toBe('Octubre')
  })
})

describe('formatRelativeDay', () => {
  const now = new Date(2026, 9, 21, 15, 0)

  it('dice "Hoy" para el mismo dia de calendario', () => {
    expect(formatRelativeDay(new Date(2026, 9, 21, 0, 5), now)).toBe('Hoy')
  })

  it('dice "Ayer" para el dia anterior aunque hayan pasado menos de 24 horas', () => {
    expect(formatRelativeDay(new Date(2026, 9, 20, 23, 30), now)).toBe('Ayer')
  })

  it('usa dia y mes corto para fechas mas viejas', () => {
    expect(formatRelativeDay(new Date(2026, 9, 12), now)).toBe('12 oct')
  })
})
