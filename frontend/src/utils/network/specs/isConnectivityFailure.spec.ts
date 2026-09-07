import { describe, expect, it } from 'vitest'
import { DebtsApiError } from '../../../services/debts/debts.service'
import { CategoriesApiError } from '../../../services/categories/categories.service'
import { GoalsApiError } from '../../../services/goals/goals.service'
import { TransactionsApiError } from '../../../services/transactions/transactions.service'
import { WalletsApiError } from '../../../services/wallets/wallets.service'
import { isConnectivityFailure } from '../isConnectivityFailure'

describe('isConnectivityFailure', () => {
  it('es true para un TypeError crudo (fetch que nunca llego a golpear al backend)', () => {
    expect(isConnectivityFailure(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('es true para cualquier otro error sin tipar', () => {
    expect(isConnectivityFailure(new Error('algo raro'))).toBe(true)
    expect(isConnectivityFailure('un string cualquiera')).toBe(true)
    expect(isConnectivityFailure(undefined)).toBe(true)
  })

  it('es false para cada uno de los rechazos tipados reales del backend', () => {
    expect(isConnectivityFailure(new TransactionsApiError('rechazado', 400))).toBe(false)
    expect(isConnectivityFailure(new WalletsApiError('rechazado', 400))).toBe(false)
    expect(isConnectivityFailure(new DebtsApiError('rechazado', 400))).toBe(false)
    expect(isConnectivityFailure(new GoalsApiError('rechazado', 400))).toBe(false)
    expect(isConnectivityFailure(new CategoriesApiError('rechazado', 400))).toBe(false)
  })
})
