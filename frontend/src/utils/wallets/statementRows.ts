import type { Transaction } from '../../services/transactions/interfaces/transactions.interface'
import type { WalletStatement } from '../../services/wallets/interfaces/wallets.interface'
import { formatCurrency } from '../formatters/formatCurrency'

// Piezas de la cartola de una billetera (WalletStatementMain.vue). Las filas las pinta el
// mismo historial que Movimientos (TransactionHistory.vue); aca solo se arma lo propio de
// la cartola: el resumen, los saldos por movimiento y la lista de movimientos en el orden
// de la cartola. Funciones puras, sin estado.
export interface StatementSummary {
  currentBalance: string
  openingBalance: string
  movementCount: number
  // Saldo inicial negativo = los movimientos suman mas plata de la que hay: falta un
  // ingreso o sobra un gasto. Es la pista para encontrar el descuadre.
  isInconsistent: boolean
}

export function buildStatementSummary(statement: WalletStatement): StatementSummary {
  return {
    currentBalance: formatCurrency(statement.currentBalance, statement.currency),
    openingBalance: formatCurrency(statement.openingBalance, statement.currency),
    movementCount: statement.entries.length,
    isInconsistent: statement.openingBalance < 0,
  }
}

// Saldo de la billetera antes y despues de cada movimiento, por id.
export function statementBalances(statement: WalletStatement | null): Map<string, { before: number; after: number }> {
  const balances = new Map<string, { before: number; after: number }>()
  for (const entry of statement?.entries ?? []) {
    balances.set(entry.id, { before: entry.balanceBefore, after: entry.balanceAfter })
  }
  return balances
}

// Los movimientos completos (los mismos objetos de Movimientos, para poder editarlos) de las
// filas de la cartola, en el orden de la cartola (del mas reciente al mas antiguo).
export function statementTransactions(statement: WalletStatement | null, all: Transaction[]): Transaction[] {
  if (!statement) return []
  const byId = new Map(all.map((transaction) => [transaction.id, transaction]))
  return statement.entries.flatMap((entry) => {
    const transaction = byId.get(entry.id)
    return transaction ? [transaction] : []
  })
}
