import { describe, expect, it } from 'vitest'
import {
  anchorDay,
  bucketLabel,
  bucketLongLabel,
  historyRange,
  isBucketInProgress,
  parseIsoDay,
  timelineRange,
  toIsoDay,
} from '../periods'

const TODAY = new Date(2026, 10, 9) // lunes 9 de noviembre de 2026

describe('periods', () => {
  it('toIsoDay y parseIsoDay son inversas y usan la fecha local', () => {
    expect(toIsoDay(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toIsoDay(parseIsoDay('2026-11-09'))).toBe('2026-11-09')
  })

  it('el mes en curso termina hoy; un mes pasado, en su ultimo dia', () => {
    expect(toIsoDay(anchorDay(2026, 10, TODAY))).toBe('2026-11-09')
    expect(toIsoDay(anchorDay(2026, 9, TODAY))).toBe('2026-10-31')
    expect(toIsoDay(anchorDay(2028, 1, TODAY))).toBe('2028-02-29')
  })

  it('el rango por dia cubre 14 dias terminando en el ancla', () => {
    expect(timelineRange('day', 2026, 10, TODAY)).toEqual({ dateFrom: '2026-10-27', dateTo: '2026-11-09' })
  })

  it('el rango por semana cubre 8 semanas', () => {
    // Hoy es lunes 9: la semana en curso es la octava, y la primera arranca el lunes 21 de septiembre.
    expect(timelineRange('week', 2026, 10, TODAY)).toEqual({ dateFrom: '2026-09-21', dateTo: '2026-11-09' })
    // Un miercoles a mitad de semana tambien alinea al lunes.
    expect(timelineRange('week', 2026, 10, new Date(2026, 10, 11))).toEqual({ dateFrom: '2026-09-21', dateTo: '2026-11-11' })
  })

  it('el rango por mes arranca 5 meses antes, cruzando el cambio de año', () => {
    expect(timelineRange('month', 2026, 1, TODAY)).toEqual({ dateFrom: '2025-09-01', dateTo: '2026-02-28' })
  })

  it('el historial termina siempre en el ultimo dia del mes elegido', () => {
    expect(historyRange(2026, 10)).toEqual({ dateFrom: '2026-06-01', dateTo: '2026-11-30' })
  })

  it('etiquetas cortas: letra del dia, dia y mes, y mes', () => {
    expect(bucketLabel('2026-11-09', 'day')).toBe('L')
    expect(bucketLabel('2026-11-09', 'week')).toBe('9 nov')
    expect(bucketLabel('2026-11-01', 'month')).toBe('Nov')
  })

  it('detecta el periodo en curso por dia, semana y mes', () => {
    expect(isBucketInProgress('2026-11-09', 'day', TODAY)).toBe(true)
    expect(isBucketInProgress('2026-11-08', 'day', TODAY)).toBe(false)
    expect(isBucketInProgress('2026-11-09', 'week', TODAY)).toBe(true)
    expect(isBucketInProgress('2026-11-02', 'week', TODAY)).toBe(false)
    expect(isBucketInProgress('2026-11-01', 'month', TODAY)).toBe(true)
  })

  it('la etiqueta larga marca el periodo en curso y agrega el año si no es el actual', () => {
    expect(bucketLongLabel('2026-11-09', 'week', TODAY)).toBe('Semana del 9 nov · en curso')
    expect(bucketLongLabel('2026-10-01', 'month', TODAY)).toBe('Octubre')
    expect(bucketLongLabel('2025-10-01', 'month', TODAY)).toBe('Octubre 2025')
  })
})
