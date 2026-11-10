// Ritmo de gasto del mes: cuanto va gastado, cuanto "tocaria" a esta altura segun el
// promedio de los meses anteriores y a donde llegaria al cierre si sigue igual.
export interface PaceSummary {
  spent: number
  /** Promedio de gasto de los meses anteriores con movimientos; 0 si no hay historial. */
  average: number
  expected: number
  projected: number
  /** Gastado menos lo esperado a esta altura (negativo = vas mejor que tu ritmo). */
  overPace: number
  /** Proyeccion de cierre menos el promedio. */
  projectedDiff: number
  /** 0-1: lo gastado respecto del promedio mensual (llena la barra). */
  fillRatio: number
  /** 0-1: que parte del mes ya paso (posicion de la marca). */
  markerRatio: number
  hasAverage: boolean
  isClosed: boolean
}

export interface PaceInput {
  spent: number
  elapsedDays: number
  daysInMonth: number
  priorExpenses: number[]
}

export function buildPace({ spent, elapsedDays, daysInMonth, priorExpenses }: PaceInput): PaceSummary {
  const history = priorExpenses.filter((value) => value > 0)
  const average = history.length ? history.reduce((sum, value) => sum + value, 0) / history.length : 0
  const days = Math.max(1, elapsedDays)
  const isClosed = elapsedDays >= daysInMonth
  const markerRatio = Math.min(1, days / daysInMonth)
  const projected = isClosed ? spent : (spent / days) * daysInMonth
  const expected = average * markerRatio
  const hasAverage = average > 0

  return {
    spent,
    average,
    expected,
    projected,
    overPace: spent - expected,
    projectedDiff: projected - average,
    fillRatio: hasAverage ? Math.min(1, spent / average) : 0,
    markerRatio,
    hasAverage,
    isClosed,
  }
}
