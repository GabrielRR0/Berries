import type { HeatCell, WeekdayAverage } from '../../services/analytics/interfaces/analytics.interface'

export interface HeatGridCell {
  day: string
  total: number
  /** 0-1: intensidad del color (raiz cuadrada, para que los dias flojos tambien se vean). */
  level: number
  /** Dia que aun no llega: se dibuja vacio. */
  empty: boolean
}

// `heat` llega ordenado y seguido desde el lunes de la semana mas antigua hasta hoy. La
// rejilla se arma por columnas (una por semana, 7 filas lunes a domingo).
export function buildHeatGrid(heat: HeatCell[], weeks: number): HeatGridCell[] {
  const max = Math.max(0, ...heat.map((cell) => cell.total))
  const cells: HeatGridCell[] = []
  for (let index = 0; index < weeks * 7; index++) {
    const cell = heat[index]
    if (!cell) {
      cells.push({ day: '', total: 0, level: 0, empty: true })
      continue
    }
    cells.push({ day: cell.day, total: cell.total, level: max > 0 ? Math.sqrt(cell.total / max) : 0, empty: false })
  }
  return cells
}

export interface WeekdayBar {
  weekday: number
  average: number
  ratio: number
  isPeak: boolean
}

export function buildWeekdayBars(averages: WeekdayAverage[]): WeekdayBar[] {
  const max = Math.max(0, ...averages.map((item) => item.average))
  return [...averages]
    .sort((a, b) => a.weekday - b.weekday)
    .map((item) => ({
      weekday: item.weekday,
      average: item.average,
      ratio: max > 0 ? item.average / max : 0,
      isPeak: max > 0 && item.average === max,
    }))
}
