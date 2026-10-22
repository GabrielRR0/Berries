import type { CategoryBreakdown } from '../../services/analytics/interfaces/analytics.interface'

// Desglose de gastos por categoria para el panel "En qué se fue el mes": las
// mayores categorias van sueltas y el resto se agrupa en "Otros" (no filtrable,
// no es una categoria real). Cada segmento lleva su "tone" (0-3), que el CSS
// convierte en color.
export interface CategorySegment {
  name: string
  total: number
  percentage: number
  tone: number
  isOthers: boolean
}

export function toCategorySegments(breakdown: CategoryBreakdown[], maxNamed = 3): CategorySegment[] {
  const sorted = [...breakdown].sort((a, b) => b.total - a.total)
  const named = sorted.slice(0, maxNamed).map((item, index) => ({
    name: item.category,
    total: item.total,
    percentage: item.percentage,
    tone: index,
    isOthers: false,
  }))
  const rest = sorted.slice(maxNamed)
  if (rest.length === 0) return named
  return [
    ...named,
    {
      name: 'Otros',
      total: rest.reduce((sum, item) => sum + item.total, 0),
      percentage: rest.reduce((sum, item) => sum + item.percentage, 0),
      tone: maxNamed,
      isOthers: true,
    },
  ]
}

// "$428" - monto sin decimales cuando son ",00", para chips y filas compactas.
export function trimZeroDecimals(formatted: string): string {
  return formatted.replace(/[.,]00(?=\D*$)/, '')
}
