import { describe, expect, it } from 'vitest'
import { buildFlowTiles, buildOverviewTiles } from '../overviewTiles'
import type { TransferStats } from '../transferStats'
import type { WalletFlow } from '../walletFlow'

const STATS: TransferStats = {
  transferCount: 3,
  sentCount: 2,
  receivedCount: 1,
  feeCount: 1,
  feeUsd: 0.07,
  feeUsdIsPartial: false,
  feePercent: 0.6,
  routes: [],
}

const FLOW: WalletFlow = {
  movementCount: 4,
  income: 100,
  incomeCount: 1,
  expense: 30,
  expenseCount: 2,
  transferIn: 20,
  transferOut: 50,
  fee: 0.06,
  feeCount: 1,
  net: 39.94,
}

describe('buildOverviewTiles', () => {
  it('arma transferencias, comisiones, comision promedio y movimientos', () => {
    const tiles = buildOverviewTiles(STATS, 5, 'month')

    expect(tiles.map((t) => t.id)).toEqual(['transfers', 'fees', 'fee-percent', 'movements'])
    expect(tiles[0].value).toBe('3')
    expect(tiles[0].hint).toContain('este mes')
    expect(tiles[1].value).toContain('0.07')
    expect(tiles[1].tone).toBe('accent')
    expect(tiles[2].value).toBe('0.60%')
    expect(tiles[3].value).toBe('5')
  })

  it('suma parcial de comisiones lleva "≥" y sin base el porcentaje es "—"', () => {
    const tiles = buildOverviewTiles({ ...STATS, feeUsdIsPartial: true, feePercent: null }, 0, 'all')

    expect(tiles[1].value.startsWith('≥')).toBe(true)
    expect(tiles[2].value).toBe('—')
  })
})

describe('buildFlowTiles', () => {
  it('muestra ingresos, gastos, transferencias enviadas/recibidas y comisiones en la moneda de la billetera', () => {
    const tiles = buildFlowTiles(FLOW, STATS, 'USDT')

    expect(tiles.map((t) => t.id)).toEqual(['income', 'expense', 'transfers', 'fees'])
    expect(tiles[0].value).toContain('100')
    expect(tiles[1].hint).toBe('2 movimientos')
    expect(tiles[2].hint).toBe('2 enviadas · 1 recibidas')
    expect(tiles[3].value).toContain('0.06')
  })
})
