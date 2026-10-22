import type { Transaction } from '../../services/transactions/interfaces/transactions.interface'
import type { TransferEditTarget } from '../../services/wallets/interfaces/wallets.interface'
import { formatCurrency } from '../formatters/formatCurrency'

// Fusion de las patas de una transferencia entre wallets propias en UNA sola
// fila "X → Y" (ver TransactionList.vue/TransactionHistory.vue). Si un filtro
// externo deja visible una sola pata, esa pata se muestra suelta en vez de
// forzar una fusion a medias. La comision (si la hubo) es su propia
// transaction real (source="manual", category="Comisión") y siempre se
// fusiona cuando esta presente.
export interface TransferListItem {
  kind: 'transfer'
  transferId: string
  occurredAt: string
  fromLeg: Transaction
  toLeg: Transaction
  feeLeg: Transaction | null
}

export interface SingleListItem {
  kind: 'single'
  transaction: Transaction
}

export type TransactionListItem = TransferListItem | SingleListItem

export function mergeTransferLegs(transactions: Transaction[]): TransactionListItem[] {
  const groups = new Map<string, { fromLeg?: Transaction; toLeg?: Transaction; feeLeg?: Transaction }>()
  for (const transaction of transactions) {
    if (!transaction.transferId) continue
    const group = groups.get(transaction.transferId) ?? {}
    if (transaction.source === 'transfer' && transaction.type === 'expense') group.fromLeg = transaction
    else if (transaction.source === 'transfer' && transaction.type === 'income') group.toLeg = transaction
    else group.feeLeg = transaction
    groups.set(transaction.transferId, group)
  }

  const emittedGroups = new Set<string>()
  const items: TransactionListItem[] = []
  for (const transaction of transactions) {
    const group = transaction.transferId ? groups.get(transaction.transferId) : undefined
    if (group?.fromLeg && group.toLeg) {
      if (emittedGroups.has(transaction.transferId!)) continue
      emittedGroups.add(transaction.transferId!)
      items.push({
        kind: 'transfer',
        transferId: transaction.transferId!,
        occurredAt: group.fromLeg.occurredAt,
        fromLeg: group.fromLeg,
        toLeg: group.toLeg,
        feeLeg: group.feeLeg ?? null,
      })
      continue
    }
    items.push({ kind: 'single', transaction })
  }
  return items
}

type CurrencyResolver = (transaction: Transaction) => string

// Texto chico bajo el titulo de una transferencia fusionada: el monto que
// realmente se movio, siempre en segundo plano (el monto grande es la
// comision). Si origen/destino tienen moneda distinta se aclaran los dos
// montos, ya que no son intercambiables 1 a 1.
export function transferSecondaryText(item: TransferListItem, currencyFor: CurrencyResolver): string {
  const fromText = formatCurrency(item.fromLeg.amount, currencyFor(item.fromLeg))
  const toCurrency = currencyFor(item.toLeg)
  if (toCurrency !== currencyFor(item.fromLeg)) return `${fromText} → ${formatCurrency(item.toLeg.amount, toCurrency)}`
  return item.feeLeg ? `${fromText} transferidos` : `${fromText} transferidos, sin comisión`
}

// Arma el TransferEditTarget que espera TransferForm.vue a partir de las
// patas ya fusionadas - convertedAmount solo tiene sentido si las monedas
// difieren.
export function transferEditTarget(item: TransferListItem, currencyFor: CurrencyResolver): TransferEditTarget {
  const toCurrency = currencyFor(item.toLeg)
  return {
    transferId: item.transferId,
    fromWalletId: item.fromLeg.walletId,
    toWalletId: item.toLeg.walletId,
    amount: item.fromLeg.amount,
    fee: item.feeLeg?.amount ?? 0,
    convertedAmount: toCurrency !== currencyFor(item.fromLeg) ? item.toLeg.amount : null,
    occurredAt: item.occurredAt,
  }
}
