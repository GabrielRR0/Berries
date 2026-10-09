import type { CreateTransactionParams, DraftInput } from '../../services/transactions/interfaces/transactions.interface'
import type { TransferParams } from '../../services/wallets/interfaces/wallets.interface'
import { buildOccurredAt } from './movementRows'
import type { ScanRow } from './movementRows'

// Lo que falta en una fila para poder registrarla segun lo que el usuario decidio
// hacer con ella. Una fila omitida o pendiente casi no exige nada (un pendiente
// existe justamente para guardar lo que todavia no se sabe).
export function rowIssues(row: ScanRow): string[] {
  const issues: string[] = []
  if (row.action === 'skip') return issues
  if (row.amount <= 0) issues.push('Falta el monto')
  if (row.action === 'pending') return issues

  if (!row.occurredOn) issues.push('Falta la fecha')

  if (row.action === 'transfer') {
    if (!row.fromWalletId) issues.push('Elige la billetera de origen')
    if (!row.toWalletId) issues.push('Elige la billetera de destino')
    if (row.fromWalletId && row.fromWalletId === row.toWalletId) issues.push('Origen y destino son la misma billetera')
    if (row.sentAmount === null || row.sentAmount <= 0) {
      issues.push(row.direction === 'in' ? 'Falta cuánto salió del origen (por ejemplo los USDT)' : 'Falta cuánto llegó al destino')
    }
    return issues
  }

  if (!row.walletId) issues.push('Elige la billetera')
  if (row.category.trim() === '') issues.push('Falta la categoría')
  return issues
}

function describe(row: ScanRow): string | undefined {
  const text = [row.description.trim(), row.reference ? `Ref. ${row.reference}` : null].filter(Boolean).join(' · ')
  return text === '' ? undefined : text
}

export interface PlannedTransfer {
  rowId: string
  label: string
  params: TransferParams
}

export interface ConfirmPlan {
  transactions: CreateTransactionParams[]
  drafts: DraftInput[]
  transfers: PlannedTransfer[]
  // Filas que no se registran (omitidas), para el resumen.
  skipped: number
}

// Traduce las decisiones del usuario a las llamadas al backend: gastos e ingresos
// (con su comision como gasto aparte) van juntos en un solo lote, los pendientes se
// guardan como borradores y las transferencias se hacen una por una.
// Solo debe llamarse con filas sin problemas (rowIssues vacio).
export function buildConfirmPlan(rows: ScanRow[]): ConfirmPlan {
  const plan: ConfirmPlan = { transactions: [], drafts: [], transfers: [], skipped: 0 }

  for (const row of rows) {
    if (row.action === 'skip') {
      plan.skipped += 1
      continue
    }

    if (row.action === 'pending') {
      plan.drafts.push({
        parsedAmount: row.amount,
        parsedCurrency: row.currency,
        parsedCategory: row.category.trim() || null,
        parsedDescription: describe(row) ?? null,
        suggestedWalletId: row.walletId || null,
        txnType: row.direction === 'in' ? 'income' : 'expense',
        occurredAt: row.occurredOn ? buildOccurredAt(row.occurredOn, row.time) : null,
        fee: row.fee > 0 ? row.fee : null,
        reference: row.reference,
      })
      continue
    }

    const occurredAt = buildOccurredAt(row.occurredOn!, row.time)

    if (row.action === 'transfer') {
      // Entra dinero (direction "in"): la captura muestra lo recibido y sentAmount es lo
      // que salio del origen. Sale dinero ("out"): al reves.
      const isIncoming = row.direction === 'in'
      plan.transfers.push({
        rowId: row.id,
        label: row.description || `Transferencia de ${row.amount}`,
        params: {
          fromWalletId: row.fromWalletId,
          toWalletId: row.toWalletId,
          amount: isIncoming ? row.sentAmount! : row.amount,
          fee: row.fee > 0 ? row.fee : undefined,
          convertedAmount: isIncoming ? row.amount : row.sentAmount!,
          occurredAt,
        },
      })
      continue
    }

    plan.transactions.push({
      walletId: row.walletId,
      type: row.action === 'income' ? 'income' : 'expense',
      amount: row.amount,
      category: row.category.trim(),
      description: describe(row),
      occurredAt,
      source: 'screenshot',
    })
    if (row.fee > 0 && row.action === 'expense') {
      plan.transactions.push({
        walletId: row.walletId,
        type: 'expense',
        amount: row.fee,
        category: 'Comisión',
        description: describe(row),
        occurredAt,
        source: 'screenshot',
      })
    }
  }
  return plan
}
