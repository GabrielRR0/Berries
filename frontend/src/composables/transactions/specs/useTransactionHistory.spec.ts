import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../../services/transactions/interfaces/transactions.interface'
import type { Wallet } from '../../../services/wallets/interfaces/wallets.interface'
import { useTransactionHistory } from '../useTransactionHistory'

const WALLETS: Wallet[] = [
  { id: 'w-usd', name: 'Principal', currency: 'USD', balance: 0, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'w-vef', name: 'Bolívares', currency: 'VEF', balance: 0, createdAt: '2026-01-01T00:00:00Z' },
]

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't',
    walletId: 'w-usd',
    type: 'expense',
    amount: 10,
    referenceAmountUsd: null,
    category: 'comida',
    description: null,
    occurredAt: '2026-10-21T12:00:00',
    source: 'manual',
    transferId: null,
    createdAt: '2026-10-21T12:00:00',
    ...overrides,
  }
}

describe('useTransactionHistory', () => {
  it('agrupa por dia y calcula el neto en USD', () => {
    const { groups } = useTransactionHistory(
      [
        tx({ id: 'a', type: 'income', amount: 100, occurredAt: '2026-10-21T09:00:00' }),
        tx({ id: 'b', amount: 40, occurredAt: '2026-10-21T13:00:00' }),
        tx({ id: 'c', amount: 5, occurredAt: '2026-10-20T13:00:00' }),
      ],
      WALLETS,
    )

    expect(groups.value).toHaveLength(2)
    expect(groups.value[0].rows).toHaveLength(2)
    expect(groups.value[0].net).toBe('+$60.00')
    expect(groups.value[1].net).toBe('-$5.00')
  })

  it('usa el valor congelado en USD para wallets en otra moneda y omite el neto si falta', () => {
    const withReference = useTransactionHistory(
      [tx({ walletId: 'w-vef', amount: 1245, referenceAmountUsd: 31.1 })],
      WALLETS,
    ).groups.value
    const withoutReference = useTransactionHistory([tx({ walletId: 'w-vef', amount: 1245 })], WALLETS).groups.value

    expect(withReference[0].net).toBe('-$31.10')
    expect(withoutReference[0].net).toBeNull()
  })

  it('fusiona una transferencia en una fila y la cuenta solo por su comision', () => {
    const { groups } = useTransactionHistory(
      [
        tx({ id: 'out', amount: 200, source: 'transfer', transferId: 'x' }),
        tx({ id: 'in', type: 'income', amount: 200, source: 'transfer', transferId: 'x', walletId: 'w-vef' }),
        tx({ id: 'fee', amount: 0.5, category: 'Comisión', transferId: 'x' }),
      ],
      WALLETS,
    )

    const rows = groups.value[0].rows
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('transfer')
    expect(rows[0].title).toBe('Principal → Bolívares')
    expect(rows[0].secondary).toBe('comisión')
    expect(groups.value[0].net).toBe('-$0.50')
  })

  it('abre una fila a la vez y pide confirmacion antes de borrar', () => {
    const { expandedId, confirmingDeleteId, toggleRow, requestDelete } = useTransactionHistory([tx({})], WALLETS)

    toggleRow('a')
    toggleRow('b')
    expect(expandedId.value).toBe('b')
    requestDelete('b')
    expect(confirmingDeleteId.value).toBe('b')
    toggleRow('b')
    expect(expandedId.value).toBeNull()
    expect(confirmingDeleteId.value).toBeNull()
  })
})
