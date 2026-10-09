// Convierte un {year, month} (month 0-indexado, misma convencion que MonthPager.vue/
// activeMonth en TransactionsMain.vue) a la clave 'YYYY-MM' que espera el backend
// (ver analytics_service.py::_resolve_month) - usado para pedir getPeriodSummary()
// del mes activo del pager, no siempre el mes calendario actual.
export function toPeriodKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}
