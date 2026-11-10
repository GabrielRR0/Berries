import { describe, expect, it } from 'vitest'
import type { PeriodSummary } from '../../../services/analytics/interfaces/analytics.interface'
import { buildKpiTiles } from '../kpis'

const SUMMARY: PeriodSummary = {
  period: '2026-11',
  totalIncome: 1000,
  totalExpense: 400,
  netSavings: 600,
  previousPeriodNetSavings: 100,
}

const base = { elapsedDays: 10, movementCount: 7, topCategory: null, biggest: null, currency: 'USD' }

describe('buildKpiTiles', () => {
  it('sin datos devuelve las mismas 8 tarjetas con guiones, para no cambiar el alto de la rejilla', () => {
    const loaded = buildKpiTiles({ ...base, summary: SUMMARY })
    const empty = buildKpiTiles({ ...base, summary: null })

    expect(empty).toHaveLength(8)
    expect(empty.map((tile) => tile.id)).toEqual(loaded.map((tile) => tile.id))
    expect(empty.every((tile) => tile.value === '—')).toBe(true)
  })

  it('calcula la tasa de ahorro y el gasto diario', () => {
    const tiles = buildKpiTiles({ ...base, summary: SUMMARY })

    expect(tiles.find((tile) => tile.id === 'rate')?.value).toBe('60%')
    expect(tiles.find((tile) => tile.id === 'daily')?.value).toBe('$40.00')
    expect(tiles.find((tile) => tile.id === 'movements')?.value).toBe('7')
  })

  it('sin ingresos la tasa de ahorro queda en guion, no en NaN ni infinito', () => {
    const tiles = buildKpiTiles({ ...base, summary: { ...SUMMARY, totalIncome: 0, netSavings: -400 } })

    expect(tiles.find((tile) => tile.id === 'rate')?.value).toBe('—')
  })

  it('el mayor gasto y la categoria principal salen de los datos recibidos', () => {
    const tiles = buildKpiTiles({
      ...base,
      summary: SUMMARY,
      topCategory: { category: 'Mercado', total: 200, percentage: 50 },
      biggest: {
        id: '1',
        occurredAt: '2026-11-07T12:00:00Z',
        category: 'Mercado',
        description: null,
        walletName: 'Efectivo',
        amount: 96,
      },
    })

    expect(tiles.find((tile) => tile.id === 'top-category')?.value).toBe('Mercado')
    expect(tiles.find((tile) => tile.id === 'top-category')?.hint).toBe('50% del gasto')
    expect(tiles.find((tile) => tile.id === 'biggest')?.value).toBe('$96.00')
    expect(tiles.find((tile) => tile.id === 'biggest')?.hint).toContain('Mercado')
  })

  it('mientras un dato no llega muestra guion neutro, y solo dice "Sin gastos aún" cuando ya llegó vacío', () => {
    const loading = buildKpiTiles({ ...base, summary: SUMMARY, movementCount: null, topCategory: undefined, biggest: undefined })
    const empty = buildKpiTiles({ ...base, summary: SUMMARY, movementCount: 0, topCategory: null, biggest: null })
    const hint = (tiles: ReturnType<typeof buildKpiTiles>, id: string) => tiles.find((tile) => tile.id === id)?.hint

    expect(loading.find((tile) => tile.id === 'movements')?.value).toBe('—')
    expect(hint(loading, 'biggest')?.trim()).toBe('')
    expect(hint(loading, 'top-category')?.trim()).toBe('')
    expect(hint(empty, 'biggest')).toBe('Sin gastos aún')
    expect(empty.find((tile) => tile.id === 'movements')?.value).toBe('0')
  })

  it('el tile de gastos va en acento y los demas en neutro', () => {
    const tiles = buildKpiTiles({ ...base, summary: SUMMARY })

    expect(tiles.filter((tile) => tile.tone === 'accent').map((tile) => tile.id)).toEqual(['expense'])
  })
})
