import type { TimelineBucket } from '../../services/analytics/interfaces/analytics.interface'

export interface BarItem {
  /** 0-1 respecto del maximo de la escala. */
  expenseRatio: number
  incomeRatio: number
}

export interface BarScale {
  bars: BarItem[]
  average: number
  averageRatio: number
}

const HEADROOM = 1.1

// Escala de las barras del grafico de flujo. Con `showIncome` falso la escala sigue solo
// al gasto (un sueldo de un dia aplastaria todas las barras diarias). El promedio ignora el
// ultimo periodo porque suele estar a medias.
export function buildBarScale(buckets: TimelineBucket[], showIncome: boolean): BarScale {
  const values = buckets.flatMap((bucket) => (showIncome ? [bucket.totalExpense, bucket.totalIncome] : [bucket.totalExpense]))
  const max = Math.max(0, ...values) * HEADROOM || 1
  const completed = buckets.length > 1 ? buckets.slice(0, -1) : buckets
  const average = completed.length ? completed.reduce((sum, bucket) => sum + bucket.totalExpense, 0) / completed.length : 0

  return {
    bars: buckets.map((bucket) => ({
      expenseRatio: bucket.totalExpense / max,
      incomeRatio: showIncome ? bucket.totalIncome / max : 0,
    })),
    average,
    averageRatio: average / max,
  }
}
