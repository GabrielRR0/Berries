import type {
  AnalyticsCompareAgainst,
  AnalyticsGranularity,
} from '../../services/analytics/interfaces/analytics.interface'

// Rangos y etiquetas de la pagina Analisis. Todo en hora local del usuario; el backend
// recibe y devuelve dias 'YYYY-MM-DD'.
export const GRANULARITY_OPTIONS: { value: AnalyticsGranularity; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
]

export const COMPARE_OPTIONS: { value: AnalyticsCompareAgainst; label: string }[] = [
  { value: 'previous', label: 'Anterior' },
  { value: 'year_ago', label: 'Año pasado' },
  { value: 'average', label: 'Promedio' },
]

const WEEKDAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
export const WEEKDAY_NAMES_MONDAY_FIRST = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
export const WEEKDAY_LETTERS_MONDAY_FIRST = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const DAYS_SHOWN = 14
const WEEKS_SHOWN = 8
const MONTHS_SHOWN = 6

const pad = (value: number) => String(value).padStart(2, '0')

export function toIsoDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseIsoDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function isCurrentMonth(year: number, month: number, today: Date = new Date()): boolean {
  return year === today.getFullYear() && month === today.getMonth()
}

/** Ultimo dia que cuenta del mes: hoy si es el mes en curso, o su ultimo dia si ya paso. */
export function anchorDay(year: number, month: number, today: Date = new Date()): Date {
  if (isCurrentMonth(year, month, today)) return new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return new Date(year, month + 1, 0)
}

export function timelineRange(
  granularity: AnalyticsGranularity,
  year: number,
  month: number,
  today: Date = new Date(),
): { dateFrom: string; dateTo: string } {
  const end = anchorDay(year, month, today)
  if (granularity === 'day') return { dateFrom: toIsoDay(addDays(end, -(DAYS_SHOWN - 1))), dateTo: toIsoDay(end) }
  if (granularity === 'week') {
    // Lunes de la semana del ancla, y 7 semanas antes: 8 semanas completas contando la actual.
    const mondayOfAnchorWeek = addDays(end, -((end.getDay() + 6) % 7))
    return { dateFrom: toIsoDay(addDays(mondayOfAnchorWeek, -(WEEKS_SHOWN - 1) * 7)), dateTo: toIsoDay(end) }
  }
  return { dateFrom: toIsoDay(new Date(year, month - (MONTHS_SHOWN - 1), 1)), dateTo: toIsoDay(end) }
}

/** Los 6 meses que terminan en el elegido: base del promedio, del ahorro acumulado y del conteo de movimientos. */
export function historyRange(year: number, month: number): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: toIsoDay(new Date(year, month - (MONTHS_SHOWN - 1), 1)),
    dateTo: toIsoDay(new Date(year, month + 1, 0)),
  }
}

function shortMonth(date: Date): string {
  return new Intl.DateTimeFormat('es-VE', { month: 'short' }).format(date).replace('.', '')
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function bucketLabel(start: string, granularity: AnalyticsGranularity): string {
  const date = parseIsoDay(start)
  if (granularity === 'day') return WEEKDAY_LETTERS[date.getDay()]
  if (granularity === 'week') return `${date.getDate()} ${shortMonth(date)}`
  return capitalize(shortMonth(date))
}

export function isBucketInProgress(start: string, granularity: AnalyticsGranularity, today: Date = new Date()): boolean {
  const first = parseIsoDay(start)
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (granularity === 'day') return first.getTime() === now.getTime()
  if (granularity === 'week') return now >= first && now < addDays(first, 7)
  return first.getFullYear() === now.getFullYear() && first.getMonth() === now.getMonth()
}

export function bucketLongLabel(start: string, granularity: AnalyticsGranularity, today: Date = new Date()): string {
  const date = parseIsoDay(start)
  let label: string
  if (granularity === 'day') {
    const weekday = new Intl.DateTimeFormat('es-VE', { weekday: 'short' }).format(date).replace('.', '')
    label = `${weekday} ${date.getDate()} ${shortMonth(date)}`
  } else if (granularity === 'week') {
    label = `Semana del ${date.getDate()} ${shortMonth(date)}`
  } else {
    const month = new Intl.DateTimeFormat('es-VE', { month: 'long' }).format(date)
    label = capitalize(date.getFullYear() === today.getFullYear() ? month : `${month} ${date.getFullYear()}`)
  }
  return isBucketInProgress(start, granularity, today) ? `${label} · en curso` : label
}

/** "7 nov" a partir de un dia 'YYYY-MM-DD' o de un instante ISO. */
export function formatDayMonth(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseIsoDay(value) : new Date(value)
  return `${date.getDate()} ${shortMonth(date)}`
}

export function granularityCaption(granularity: AnalyticsGranularity): string {
  if (granularity === 'day') return 'Últimos 14 días'
  if (granularity === 'week') return 'Últimas 8 semanas'
  return 'Últimos 6 meses'
}
