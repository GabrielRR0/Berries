import { describe, expect, it } from 'vitest'
import { buildConfirmPlan, rowIssues } from '../confirmPlan'
import { makeRow } from '../movementRows'
import type { ScanRow } from '../movementRows'

function expense(partial: Partial<ScanRow> = {}): ScanRow {
  return makeRow({
    source: 'bank',
    amount: 22848,
    direction: 'out',
    currency: 'VEF',
    occurredOn: '2026-10-08',
    time: '22:25',
    description: 'Operacion pagomovil bdv',
    walletId: 'bs',
    category: 'Mercado',
    ...partial,
  })
}

describe('rowIssues', () => {
  it('un gasto completo no tiene problemas', () => {
    expect(rowIssues(expense())).toEqual([])
  })

  it('pide categoria, billetera y fecha si faltan', () => {
    const issues = rowIssues(expense({ category: ' ', walletId: '', occurredOn: null }))

    expect(issues).toEqual(['Falta la fecha', 'Elige la billetera', 'Falta la categoría'])
  })

  it('una fila omitida no exige nada y un pendiente solo el monto', () => {
    expect(rowIssues(expense({ action: 'skip', category: '', walletId: '', occurredOn: null }))).toEqual([])
    expect(rowIssues(expense({ action: 'pending', category: '', walletId: '', occurredOn: null }))).toEqual([])
    expect(rowIssues(expense({ action: 'pending', amount: 0 }))).toEqual(['Falta el monto'])
  })

  it('una transferencia pide origen, destino distintos y lo enviado', () => {
    const base = expense({ direction: 'in', action: 'transfer' })

    expect(rowIssues(base)).toEqual([
      'Elige la billetera de origen',
      'Elige la billetera de destino',
      'Falta cuánto salió del origen (por ejemplo los USDT)',
    ])
    expect(rowIssues({ ...base, fromWalletId: 'a', toWalletId: 'a', sentAmount: 10 })).toEqual([
      'Origen y destino son la misma billetera',
    ])
    expect(rowIssues({ ...base, fromWalletId: 'usdt', toWalletId: 'bs', sentAmount: 26.48 })).toEqual([])
  })
})

describe('buildConfirmPlan', () => {
  it('un gasto con comision crea el gasto y la comision como gasto aparte', () => {
    const plan = buildConfirmPlan([expense({ fee: 68.54, reference: '007608296806' })])

    expect(plan.transactions).toHaveLength(2)
    expect(plan.transactions[0]).toMatchObject({
      walletId: 'bs',
      type: 'expense',
      amount: 22848,
      category: 'Mercado',
      description: 'Operacion pagomovil bdv · Ref. 007608296806',
      source: 'screenshot',
    })
    expect(plan.transactions[1]).toMatchObject({ amount: 68.54, category: 'Comisión', type: 'expense' })
  })

  it('la fecha y la hora de la captura llegan al movimiento', () => {
    const [transaction] = buildConfirmPlan([expense()]).transactions
    const date = new Date(transaction!.occurredAt!)

    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([
      2026, 9, 8, 22, 25,
    ])
  })

  it('un recibido enlazado a una orden es una transferencia USDT -> Bs con lo recibido como monto convertido', () => {
    const plan = buildConfirmPlan([
      expense({
        direction: 'in',
        action: 'transfer',
        amount: 26600,
        sentAmount: 26.48,
        fromWalletId: 'usdt',
        toWalletId: 'bs',
        category: '',
      }),
    ])

    expect(plan.transactions).toHaveLength(0)
    expect(plan.transfers[0]!.params).toMatchObject({
      fromWalletId: 'usdt',
      toWalletId: 'bs',
      amount: 26.48,
      convertedAmount: 26600,
    })
  })

  it('un pago que sale de la billetera y se transfiere: el monto es lo que sale', () => {
    const plan = buildConfirmPlan([
      expense({
        amount: 100,
        currency: 'USD',
        action: 'transfer',
        sentAmount: 100,
        fromWalletId: 'facebank',
        toWalletId: 'usdt',
      }),
    ])

    expect(plan.transfers[0]!.params).toMatchObject({ amount: 100, convertedAmount: 100, fromWalletId: 'facebank' })
  })

  it('un pendiente guarda lo que se sabe y deja vacio lo demas', () => {
    const plan = buildConfirmPlan([
      expense({ direction: 'in', action: 'pending', amount: 26600, category: '', occurredOn: null, walletId: 'bs' }),
    ])

    expect(plan.drafts).toEqual([
      expect.objectContaining({
        parsedAmount: 26600,
        parsedCurrency: 'VEF',
        parsedCategory: null,
        suggestedWalletId: 'bs',
        txnType: 'income',
        occurredAt: null,
      }),
    ])
    expect(plan.transactions).toHaveLength(0)
  })

  it('las filas omitidas no generan nada y se cuentan', () => {
    const plan = buildConfirmPlan([expense({ action: 'skip' }), expense({ action: 'skip' }), expense()])

    expect(plan.skipped).toBe(2)
    expect(plan.transactions).toHaveLength(1)
  })
})
