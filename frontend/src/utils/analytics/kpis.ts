import type {
  CategoryBreakdown,
  PeriodSummary,
  TopTransaction,
} from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../formatters/formatCurrency'
import type { StatTile } from '../wallets/overviewTiles'
import { formatDayMonth } from './periods'

export interface KpiInput {
  summary: PeriodSummary | null
  elapsedDays: number
  /** null = aun no llega el dato. */
  movementCount: number | null
  /** undefined = aun no llega; null = llego y no hay gastos. */
  topCategory: CategoryBreakdown | null | undefined
  biggest: TopTransaction | null | undefined
  currency: string
}

const PLACEHOLDERS: Omit<StatTile, 'value' | 'hint'>[] = [
  { id: 'income', label: 'Ingresos', icon: 'in', tone: 'neutral' },
  { id: 'expense', label: 'Gastos', icon: 'out', tone: 'accent' },
  { id: 'net', label: 'Ahorro neto', icon: 'swap', tone: 'neutral' },
  { id: 'rate', label: 'Tasa de ahorro', icon: 'percent', tone: 'neutral' },
  { id: 'daily', label: 'Gasto diario', icon: 'list', tone: 'neutral' },
  { id: 'biggest', label: 'Mayor gasto', icon: 'out', tone: 'neutral' },
  { id: 'top-category', label: 'Categoría principal', icon: 'list', tone: 'neutral' },
  { id: 'movements', label: 'Movimientos', icon: 'list', tone: 'neutral' },
]

// Las 8 tarjetas de datos clave. Siempre devuelve las mismas 8 (con guiones mientras no
// hay datos) para que la rejilla no cambie de alto al cargar.
export function buildKpiTiles(input: KpiInput): StatTile[] {
  const { summary, elapsedDays, movementCount, topCategory, biggest, currency } = input
  if (!summary) return PLACEHOLDERS.map((tile) => ({ ...tile, value: '—', hint: ' ' }))
  const money = (value: number) => formatCurrency(value, currency)
  const savingsRate = summary.totalIncome > 0 ? Math.round((summary.netSavings / summary.totalIncome) * 100) : null

  return [
    { id: 'income', label: 'Ingresos', value: money(summary.totalIncome), hint: 'Entró este mes', icon: 'in', tone: 'neutral' },
    { id: 'expense', label: 'Gastos', value: money(summary.totalExpense), hint: 'Salió este mes', icon: 'out', tone: 'accent' },
    {
      id: 'net',
      label: 'Ahorro neto',
      value: money(summary.netSavings),
      hint:
        summary.previousPeriodNetSavings === null
          ? 'Tu primer mes en Berry'
          : `Mes pasado: ${money(summary.previousPeriodNetSavings)}`,
      icon: 'swap',
      tone: 'neutral',
    },
    {
      id: 'rate',
      label: 'Tasa de ahorro',
      value: savingsRate === null ? '—' : `${savingsRate}%`,
      hint: 'De lo que ingresó',
      icon: 'percent',
      tone: 'neutral',
    },
    {
      id: 'daily',
      label: 'Gasto diario',
      value: money(elapsedDays > 0 ? summary.totalExpense / elapsedDays : 0),
      hint: `Promedio de ${elapsedDays} ${elapsedDays === 1 ? 'día' : 'días'}`,
      icon: 'list',
      tone: 'neutral',
    },
    {
      id: 'biggest',
      label: 'Mayor gasto',
      value: biggest ? money(biggest.amount) : '—',
      hint: biggest ? `${biggest.category} · ${formatDayMonth(biggest.occurredAt)}` : biggest === null ? 'Sin gastos aún' : ' ',
      icon: 'out',
      tone: 'neutral',
    },
    {
      id: 'top-category',
      label: 'Categoría principal',
      value: topCategory ? topCategory.category : '—',
      hint: topCategory ? `${Math.round(topCategory.percentage)}% del gasto` : topCategory === null ? 'Sin gastos aún' : ' ',
      icon: 'list',
      tone: 'neutral',
    },
    {
      id: 'movements',
      label: 'Movimientos',
      value: movementCount === null ? '—' : String(movementCount),
      hint: movementCount === null ? ' ' : 'Registrados en el mes',
      icon: 'list',
      tone: 'neutral',
    },
  ]
}
