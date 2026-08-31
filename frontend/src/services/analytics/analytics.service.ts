// Servicio fetch-based del dominio analytics (mismo patron que
// services/auth/auth.service.ts y services/debts/debts.service.ts):
// funciones planas, sin axios, que mapean la respuesta snake_case del
// backend a interfaces TS en camelCase. Cada funcion lee el token actual
// llamando useAuthStore() adentro (nunca a nivel de modulo) y lo manda como
// Authorization: Bearer <token>.

import { useAuthStore } from '../../stores/auth.store'
import type { AnalyticsCategoryType, CategoryBreakdown, MonthlyComparison, PeriodSummary } from './interfaces/analytics.interface'

// Forma "sobre el cable" tal cual la devuelve el backend (ver
// berry/backend/app/schemas/analytics/*) - solo interna a este archivo, el
// resto de la app siempre trabaja con PeriodSummary/CategoryBreakdown/
// MonthlyComparison.
interface PeriodSummaryWire {
  period: string
  total_income: number
  total_expense: number
  net_savings: number
  previous_period_net_savings: number
}

interface CategoryBreakdownWire {
  category: string
  total: number
  percentage: number
}

interface MonthlyComparisonWire {
  month: string
  total_income: number
  total_expense: number
  net: number
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
    totalIncome: wire.total_income,
    totalExpense: wire.total_expense,
    netSavings: wire.net_savings,
    previousPeriodNetSavings: wire.previous_period_net_savings,
  }
}

function mapCategoryBreakdown(wire: CategoryBreakdownWire): CategoryBreakdown {
  return { category: wire.category, total: wire.total, percentage: wire.percentage }
}

function mapMonthlyComparison(wire: MonthlyComparisonWire): MonthlyComparison {
  return { month: wire.month, totalIncome: wire.total_income, totalExpense: wire.total_expense, net: wire.net }
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
