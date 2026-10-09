import { describe, expect, it } from 'vitest'
import { applyScanContext } from '../applyScanContext'
import { makeRow } from '../movementRows'
import type { ScanRow } from '../movementRows'

// Venta P2P (llegan Bs, salen USDT) y compra P2P (salen Bs, entran USDT).
function order(direction: 'in' | 'out'): ScanRow {
  return makeRow({
    source: 'p2p_order',
    amount: 26600,
    currency: 'VEF',
    direction,
    occurredOn: '2026-10-08',
    description: 'Binance P2P · Nelasurej',
    action: 'transfer',
    sentAmount: 26.48,
    p2p: { usdt: 26.48, price: 1006.5, orderNumber: '22941692196588679168', counterparty: 'Nelasurej' },
  })
}

function bank(direction: 'in' | 'out', amount: number): ScanRow {
  return makeRow({ source: 'bank', amount, currency: 'VEF', direction, occurredOn: '2026-10-08', description: 'Pago' })
}

describe('applyScanContext', () => {
  it('con "todo" deja las filas como se leyeron', () => {
    const rows = [order('in'), bank('out', 100)]

    expect(applyScanContext(rows, { scope: 'all' })).toEqual(rows)
  })

  it('una orden P2P es una transferencia: no es gasto ni ingreso, asi que "solo gastos" e "ingresos" la dejan fuera', () => {
    const rows = [order('in'), order('out'), bank('out', 9000), bank('in', 5000)]

    expect(applyScanContext(rows, { scope: 'expenses' }).map((row) => [row.source, row.amount])).toEqual([['bank', 9000]])
    expect(applyScanContext(rows, { scope: 'received' }).map((row) => [row.source, row.amount])).toEqual([['bank', 5000]])
  })

  describe('"Transferencias"', () => {
    it('los movimientos del banco quedan pendientes de enlazar con su orden', () => {
      const rows = applyScanContext([bank('in', 26600), bank('out', 9000)], { scope: 'transfers' })

      expect(rows.map((row) => row.action)).toEqual(['pending', 'pending'])
    })

    it('las ordenes siguen siendo transferencias con sus USDT', () => {
      const [transfer] = applyScanContext([order('in')], { scope: 'transfers' })

      expect(transfer).toMatchObject({ source: 'p2p_order', action: 'transfer', sentAmount: 26.48 })
    })

    it('no toca lo que el usuario ya decidio (una fila omitida sigue omitida)', () => {
      const skipped = { ...bank('in', 100), action: 'skip' as const }

      expect(applyScanContext([skipped], { scope: 'transfers' })[0]!.action).toBe('skip')
    })
  })
describe('applyScanContext - "otra transferencia" (sin Binance)', () => {
  it('cada movimiento del banco es una transferencia desde la billetera elegida, sin esperar una orden', () => {
    const rows = applyScanContext([bank('out', 100), bank('in', 5000)], { scope: 'transfers', transferKind: 'other' })

    expect(rows.map((row) => row.action)).toEqual(['transfer', 'transfer'])
  })

  it('sin indicar el tipo se toma P2P (pendientes de enlazar con su orden)', () => {
    const rows = applyScanContext([bank('in', 5000)], { scope: 'transfers' })

    expect(rows[0]!.action).toBe('pending')
  })

  it('las ordenes de Binance siguen siendo transferencias en cualquiera de los dos tipos', () => {
    for (const transferKind of ['p2p', 'other'] as const) {
      const [transfer] = applyScanContext([order('in')], { scope: 'transfers', transferKind })

      expect(transfer).toMatchObject({ source: 'p2p_order', action: 'transfer' })
    }
  })
})
})
