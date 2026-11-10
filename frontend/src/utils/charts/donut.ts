import type { CategoryBreakdown } from '../../services/analytics/interfaces/analytics.interface'

export interface DonutSlice {
  category: string
  total: number
  percentage: number
}

export interface DonutSegment extends DonutSlice {
  index: number
  /** stroke-dasharray sobre un circulo de circunferencia 100. */
  dashArray: string
  dashOffset: number
  color: string
}

const OTHER_LABEL = 'Otros'
const GRAY_OPACITIES = [0.85, 0.6, 0.42, 0.3, 0.2]
const DIMMED = 'rgba(246, 246, 247, 0.1)'

// Las `maxNamed` categorias mas grandes y el resto junto en "Otros".
export function groupSlices(items: CategoryBreakdown[], maxNamed = 5): DonutSlice[] {
  const sorted = [...items].sort((a, b) => b.total - a.total)
  const head = sorted.slice(0, maxNamed)
  const rest = sorted.slice(maxNamed)
  const grand = sorted.reduce((sum, item) => sum + item.total, 0)
  const slices = head.map((item) => ({
    category: item.category,
    total: item.total,
    percentage: grand > 0 ? (item.total / grand) * 100 : 0,
  }))
  if (rest.length) {
    const total = rest.reduce((sum, item) => sum + item.total, 0)
    slices.push({ category: OTHER_LABEL, total, percentage: grand > 0 ? (total / grand) * 100 : 0 })
  }
  return slices
}

// La mas grande lleva el acento; el resto una rampa de grises. Con una seleccionada, solo
// esa conserva color.
export function sliceColor(index: number, selected: number | null): string {
  if (selected !== null) return index === selected ? 'var(--accent)' : DIMMED
  if (index === 0) return 'var(--accent)'
  return `rgba(246, 246, 247, ${GRAY_OPACITIES[Math.min(index - 1, GRAY_OPACITIES.length - 1)]})`
}

export function buildDonutSegments(slices: DonutSlice[], selected: number | null): DonutSegment[] {
  const grand = slices.reduce((sum, slice) => sum + slice.total, 0)
  let cumulative = 0
  return slices.map((slice, index) => {
    const share = grand > 0 ? (slice.total / grand) * 100 : 0
    const segment: DonutSegment = {
      ...slice,
      index,
      dashArray: `${Math.max(0, share - 0.6)} ${100 - Math.max(0, share - 0.6)}`,
      dashOffset: 25 - cumulative,
      color: sliceColor(index, selected),
    }
    cumulative += share
    return segment
  })
}
