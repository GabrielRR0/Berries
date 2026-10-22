export function formatDate(date: string | Date, locale = 'es-VE'): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

// Usado por MonthPager.vue - con el año explicito (no solo "Agosto") para
// que no quede ambiguo al pasar de diciembre a enero de otro año.
export function formatMonthYear(year: number, month: number, locale = 'es-VE'): string {
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Solo el nombre del mes ("Octubre") - titulo de la seccion de resumen del
// mes en Inicio.
export function formatMonthName(date: Date = new Date(), locale = 'es-VE'): string {
  const label = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

// "Hoy" / "Ayer" / "12 oct" - fecha corta de las filas compactas de
// "Ultimos movimientos" en Inicio, donde el dia exacto pesa menos que
// cuan reciente fue. Compara dias de calendario (no 24h), asi un gasto de
// anoche cuenta como "Ayer" aunque hayan pasado menos de 24 horas.
export function formatRelativeDay(date: string | Date, now: Date = new Date(), locale = 'es-VE'): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
  const daysAgo = Math.round((startOfDay(now) - startOfDay(parsed)) / MS_PER_DAY)
  if (daysAgo === 0) return 'Hoy'
  if (daysAgo === 1) return 'Ayer'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(parsed).replace('.', '')
}

// "mié 21 oct" - dia de la semana + dia + mes, sin comas ni puntos.
function formatWeekdayDay(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' })
    .format(date)
    .replace(/[,.]/g, '')
}

// Titulo de un grupo de dia en Movimientos: "Hoy · mié 21 oct", "Ayer · mar
// 20 oct" y, pasados dos dias, solo "lun 19 oct".
export function formatDayHeading(date: string | Date, now: Date = new Date(), locale = 'es-VE'): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
  const relative = formatRelativeDay(parsed, now, locale)
  const absolute = formatWeekdayDay(parsed, locale)
  return relative === 'Hoy' || relative === 'Ayer' ? `${relative} · ${absolute}` : absolute
}

// "13:40" - hora local del movimiento (detalle expandido de una fila).
export function formatTime(date: string | Date, locale = 'es-VE'): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed)
}
