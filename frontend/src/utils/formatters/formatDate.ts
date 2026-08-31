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
