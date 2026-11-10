import type { WalletStatementEntry } from '../../services/wallets/interfaces/wallets.interface'
import { isInStatsPeriod } from './transferStats'
import type { StatsPeriod } from './transferStats'

// Resumen de lo que entro y salio de UNA billetera en un periodo, en la moneda de la billetera
// (cartola). Separa lo que es plata real (ingresos, gastos) de lo que solo se mueve entre
// billeteras propias (transferencias) y de las comisiones de esas transferencias.
export interface WalletFlow {
  movementCount: number
  income: number
  incomeCount: number
  // Gastos reales: sin patas de transferencia ni comisiones (esas van aparte).
  expense: number
  expenseCount: number
  transferIn: number
  transferOut: number
  fee: number
  feeCount: number
  // Salida total (gastos + transferencias enviadas + comisiones) menos entradas totales.
  net: number
}

// La comision de una transferencia es un gasto con transferId y source "manual"
// (a diferencia de las dos patas, que son source "transfer").
function isFee(entry: WalletStatementEntry): boolean {
  return entry.type === 'expense' && entry.source !== 'transfer' && entry.transferId !== null
}

export function computeWalletFlow(
  entries: WalletStatementEntry[],
  period: StatsPeriod,
  now: Date = new Date(),
): WalletFlow {
  const flow: WalletFlow = {
    movementCount: 0,
    income: 0,
    incomeCount: 0,
    expense: 0,
    expenseCount: 0,
    transferIn: 0,
    transferOut: 0,
    fee: 0,
    feeCount: 0,
    net: 0,
  }
  for (const entry of entries) {
    if (!isInStatsPeriod(entry.occurredAt, period, now)) continue
    flow.movementCount++
    flow.net += entry.type === 'income' ? entry.amount : -entry.amount
    if (entry.source === 'transfer') {
      if (entry.type === 'income') flow.transferIn += entry.amount
      else flow.transferOut += entry.amount
    } else if (isFee(entry)) {
      flow.fee += entry.amount
      flow.feeCount++
    } else if (entry.type === 'income') {
      flow.income += entry.amount
      flow.incomeCount++
    } else {
      flow.expense += entry.amount
      flow.expenseCount++
    }
  }
  return flow
}
