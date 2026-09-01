// Servicio fetch-based del dominio analytics (mismo patron que
// services/auth/auth.service.ts y services/debts/debts.service.ts):
// funciones planas, sin axios, que mapean la respuesta snake_case del
// backend a interfaces TS en camelCase. Cada funcion lee el token actual
// llamando useAuthStore() adentro (nunca a nivel de modulo) y lo manda como
// Authorization: Bearer <token>.

import { useAuthStore } from '../../stores/auth.store'
import type {
  AnalyticsCategoryType,
  CategoryBreakdown,
  CategoryMonthlyTrend,
  MonthlyComparison,
  PeriodSummary,
} from './interfaces/analytics.interface'

// Forma "sobre el cable" tal cual la devuelve el backend (ver
// berry/backend/app/schemas/analytics/*) - solo interna a este archivo, el
// resto de la app siempre trabaja con PeriodSummary/CategoryBreakdown/
// MonthlyComparison. Los campos Decimal viajan como STRING en el JSON (no
// como number - FastAPI/Pydantic los serializa asi), mismo bug ya encontrado
// y corregido en goals.service.ts/debts.service.ts: se tipan number|string
// aca y se normalizan con Number(...) en cada mapper de abajo.
interface PeriodSummaryWire {
  period: string
  total_income: number | string
  total_expense: number | string
  net_savings: number | string
  previous_period_net_savings: number | string
}

interface CategoryBreakdownWire {
  category: string
  total: number | string
  percentage: number
}

interface MonthlyComparisonWire {
  month: string
  total_income: number | string
  total_expense: number | string
  net: number | string
}

interface CategoryMonthlyTrendItemWire {
  category: string
  monthly_totals: (number | string)[]
}

interface CategoryMonthlyTrendWire {
  months: string[]
  categories: CategoryMonthlyTrendItemWire[]
}

// Error tipado que carga el status HTTP ademas del mensaje (ver
// AuthApiError/DebtsApiError) para que la UI distinga casos sin parsear el
// texto del mensaje.
export class AnalyticsApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AnalyticsApiError'
    this.status = status
  }
}

// Sin VITE_API_BASE_URL, queda '' y las rutas quedan relativas ('/api/...'):
// funciona en dev via el proxy de vite.config.ts.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function mapPeriodSummary(wire: PeriodSummaryWire): PeriodSummary {
  return {
    period: wire.period,
    totalIncome: Number(wire.total_income),
    totalExpense: Number(wire.total_expense),
    netSavings: Number(wire.net_savings),
    previousPeriodNetSavings: Number(wire.previous_period_net_savings),
  }
}

function mapCategoryBreakdown(wire: CategoryBreakdownWire): CategoryBreakdown {
  return { category: wire.category, total: Number(wire.total), percentage: wire.percentage }
}

function mapMonthlyComparison(wire: MonthlyComparisonWire): MonthlyComparison {
  return {
    month: wire.month,
    totalIncome: Number(wire.total_income),
    totalExpense: Number(wire.total_expense),
    net: Number(wire.net),
  }
}

function mapCategoryMonthlyTrend(wire: CategoryMonthlyTrendWire): CategoryMonthlyTrend {
  return {
    months: wire.months,
    categories: wire.categories.map((entry) => ({
      category: entry.category,
      monthlyTotals: entry.monthly_totals.map(Number),
    })),
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

// No hay una capa "API client" compartida a proposito (ver limites del
// trabajo): cada funcion de este archivo llama useAuthStore() y arma sus
// propios headers directo en el fetch.
function authHeaders(): Record<string, string> {
  const token = useAuthStore().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getPeriodSummary(month?: string): Promise<PeriodSummary> {
  const query = month ? `?month=${month}` : ''

  const response = await fetch(`${API_BASE_URL}/api/analytics/summary${query}`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new AnalyticsApiError(
      await parseErrorMessage(response, 'No se pudo obtener el resumen del período.'),
      response.status,
    )
  }

  return mapPeriodSummary((await response.json()) as PeriodSummaryWire)
}

export async function getCategoryBreakdown(
  type: AnalyticsCategoryType,
  month?: string,
): Promise<CategoryBreakdown[]> {
  const params = new URLSearchParams({ type })
  if (month) params.set('month', month)

  const response = await fetch(`${API_BASE_URL}/api/analytics/categories?${params.toString()}`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new AnalyticsApiError(
      await parseErrorMessage(response, 'No se pudo obtener el desglose por categoría.'),
      response.status,
    )
  }

  return ((await response.json()) as CategoryBreakdownWire[]).map(mapCategoryBreakdown)
}

export async function getMonthlyComparison(months?: number): Promise<MonthlyComparison[]> {
  const query = months !== undefined ? `?months=${months}` : ''

  const response = await fetch(`${API_BASE_URL}/api/analytics/monthly${query}`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new AnalyticsApiError(
      await parseErrorMessage(response, 'No se pudo obtener la comparación mensual.'),
      response.status,
    )
  }

  return ((await response.json()) as MonthlyComparisonWire[]).map(mapMonthlyComparison)
}

export async function getCategoryMonthlyTrend(
  type: AnalyticsCategoryType,
  months?: number,
): Promise<CategoryMonthlyTrend> {
  const params = new URLSearchParams({ type })
  if (months !== undefined) params.set('months', String(months))

  const response = await fetch(`${API_BASE_URL}/api/analytics/categories/trend?${params.toString()}`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new AnalyticsApiError(
      await parseErrorMessage(response, 'No se pudo obtener la tendencia por categoría.'),
      response.status,
    )
  }

  return mapCategoryMonthlyTrend((await response.json()) as CategoryMonthlyTrendWire)
}
