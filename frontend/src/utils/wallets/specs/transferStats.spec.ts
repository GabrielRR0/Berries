import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../../services/transactions/interfaces/transactions.interface'
import type { Wallet, WalletStatementEntry } from '../../../services/wallets/interfaces/wallets.interface'
import { computeTransferStats, isInStatsPeriod } from '../transferStats'
import { computeWalletFlow } from '../walletFlow'

const NOW = new Date(2026, 10, 15, 12, 0, 0)
const WALLETS: Wallet[] = [
  { id: 'usd', name: 'Zinli', currency: 'USD', balance: 0, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'usdt', name: 'Tether', currency: 'USDT', balance: 0, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'vef', name: 'Banco Vnz', currency: 'VEF', balance: 0, createdAt: '2026-01-01T00:00:00Z' },
]

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't',
    walletId: 'usd',
    type: 'expense',
    amount: 10,
    referenceAmountUsd: null,
    category: 'Comida',
    description: null,
    occurredAt: new Date(2026, 10, 10, 12).toISOString(),
    source: 'manual',
    transferId: null,
    createdAt: '2026-11-10T12:00:00Z',
    ...overrides,
  }
}

// Transferencia usdt -> vef de 50 USDT con comision de 0.5 USDT (valor congelado $0.5).
function transfer(id: string, occurredAt: string, fee: number | null): Transaction[] {
  const legs = [
    tx({ id: `${id}-out`, walletId: 'usdt', amount: 50, referenceAmountUsd: 50, source: 'transfer', transferId: id, occurredAt, category: 'Transferencia' }),
    tx({ id: `${id}-in`, walletId: 'vef', type: 'income', amount: 52000, referenceAmountUsd: 50, source: 'transfer', transferId: id, occurredAt, category: 'Transferencia' }),
  ]
  if (fee !== null) {
    legs.push(tx({ id: `${id}-fee`, walletId: 'usdt', amount: fee, referenceAmountUsd: fee, source: 'manual', transferId: id, occurredAt, category: 'Comisión' }))
  }
  return legs
}

describe('isInStatsPeriod', () => {
  it('mes = desde el dia 1 del mes actual; 30d = ventana movil; all = todo', () => {
    expect(isInStatsPeriod(new Date(2026, 10, 1).toISOString(), 'month', NOW)).toBe(true)
    expect(isInStatsPeriod(new Date(2026, 9, 31).toISOString(), 'month', NOW)).toBe(false)
    expect(isInStatsPeriod(new Date(2026, 9, 20).toISOString(), '30d', NOW)).toBe(true)
    expect(isInStatsPeriod(new Date(2026, 9, 1).toISOString(), '30d', NOW)).toBe(false)
    expect(isInStatsPeriod(new Date(2020, 0, 1).toISOString(), 'all', NOW)).toBe(true)
  })
})

describe('computeTransferStats', () => {
  const all = [
    ...transfer('a', new Date(2026, 10, 3).toISOString(), 0.5),
    ...transfer('b', new Date(2026, 10, 9).toISOString(), 1.5),
    ...transfer('c', new Date(2026, 10, 12).toISOString(), null),
    tx({ id: 'gasto', amount: 20 }),
  ]

  it('cuenta transferencias y suma comisiones, ignorando movimientos normales', () => {
    const stats = computeTransferStats(all, WALLETS, 'month', { now: NOW })

    expect(stats.transferCount).toBe(3)
    expect(stats.feeCount).toBe(2)
    expect(stats.feeUsd).toBeCloseTo(2)
    expect(stats.feeUsdIsPartial).toBe(false)
    // 2 de comision sobre 150 USD movidos.
    expect(stats.feePercent).toBeCloseTo(1.333, 2)
  })

  it('agrupa por ruta y ordena por lo que mas comision costo', () => {
    const stats = computeTransferStats(all, WALLETS, 'month', { now: NOW })

    expect(stats.routes).toHaveLength(1)
    expect(stats.routes[0]).toMatchObject({
      fromName: 'Tether',
      toName: 'Banco Vnz',
      count: 3,
      feeCount: 2,
      feeNative: 2,
      feeCurrency: 'USDT',
      feeUsd: 2,
    })
  })

  it('sin % de comision si una transferencia con comision no tiene valor en USD (evita un 0% enganoso)', () => {
    const noUsd = transfer('e', new Date(2026, 10, 5).toISOString(), 0.5).map((t) => ({ ...t, referenceAmountUsd: null }))

    const stats = computeTransferStats([...noUsd, ...transfer('f', new Date(2026, 10, 6).toISOString(), null)], WALLETS, 'month', { now: NOW })

    expect(stats.feePercent).toBeNull()
  })

  it('respeta el periodo', () => {
    const stats = computeTransferStats(all, WALLETS, 'month', { now: new Date(2026, 11, 20) })

    expect(stats.transferCount).toBe(0)
    expect(stats.routes).toEqual([])
    expect(stats.feePercent).toBeNull()
  })

  it('marca la suma como parcial si una comision no tiene valor en USD', () => {
    const noUsd = transfer('d', new Date(2026, 10, 5).toISOString(), 0.5).map((t) =>
      t.category === 'Comisión' ? { ...t, referenceAmountUsd: null } : t,
    )

    const stats = computeTransferStats(noUsd, WALLETS, 'month', { now: NOW })

    expect(stats.feeUsdIsPartial).toBe(true)
    expect(stats.routes[0].feeUsd).toBeNull()
    expect(stats.routes[0].feeNative).toBe(0.5)
  })

  it('filtrado por billetera: enviadas, recibidas y solo comisiones que ella pago', () => {
    const asSender = computeTransferStats(all, WALLETS, 'month', { walletId: 'usdt', now: NOW })
    const asReceiver = computeTransferStats(all, WALLETS, 'month', { walletId: 'vef', now: NOW })

    expect(asSender).toMatchObject({ transferCount: 3, sentCount: 3, receivedCount: 0, feeCount: 2 })
    expect(asReceiver).toMatchObject({ transferCount: 3, sentCount: 0, receivedCount: 3, feeCount: 0, feeUsd: 0 })
    expect(asReceiver.routes).toEqual([])
  })
})

describe('computeWalletFlow', () => {
  function entry(overrides: Partial<WalletStatementEntry>): WalletStatementEntry {
    return {
      id: 'e',
      type: 'expense',
      amount: 10,
      balanceBefore: 0,
      balanceAfter: 0,
      category: 'Comida',
      description: null,
      occurredAt: new Date(2026, 10, 10).toISOString(),
      source: 'manual',
      transferId: null,
      referenceAmountUsd: null,
      ...overrides,
    }
  }

  it('separa ingresos, gastos reales, transferencias y comisiones', () => {
    const flow = computeWalletFlow(
      [
        entry({ type: 'income', amount: 100, category: 'Salario' }),
        entry({ amount: 30 }),
        entry({ amount: 50, source: 'transfer', transferId: 'x' }),
        entry({ type: 'income', amount: 20, source: 'transfer', transferId: 'y' }),
        entry({ amount: 0.5, transferId: 'x', category: 'Comisión' }),
      ],
      'all',
      NOW,
    )

    expect(flow).toMatchObject({
      movementCount: 5,
      income: 100,
      incomeCount: 1,
      expense: 30,
      expenseCount: 1,
      transferOut: 50,
      transferIn: 20,
      fee: 0.5,
      feeCount: 1,
    })
    expect(flow.net).toBeCloseTo(100 - 30 - 50 + 20 - 0.5)
  })

  it('solo cuenta lo que cae en el periodo', () => {
    const flow = computeWalletFlow([entry({ occurredAt: new Date(2026, 8, 1).toISOString() })], 'month', NOW)

    expect(flow.movementCount).toBe(0)
  })
})
