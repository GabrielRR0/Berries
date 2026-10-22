import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { Transaction } from '../../services/transactions/interfaces/transactions.interface'
import type { TransferEditTarget, Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { formatDate, formatDayHeading, formatTime } from '../../utils/formatters/formatDate'
import { mergeTransferLegs, transferEditTarget, transferSecondaryText } from '../../utils/transactions/transactionListItems'
import type { TransactionListItem } from '../../utils/transactions/transactionListItems'

// Logica de TransactionHistory.vue (historial de Movimientos): fusiona las
// patas de transferencia, arma un view-model por fila (titulo, monto,
// detalle expandible) y agrupa por dia con su neto. El componente solo pinta.
export type HistoryRowKind = 'income' | 'expense' | 'transfer'
export type HistoryAmountTone = 'neutral' | 'expense'

export interface HistoryRowDetail {
  label: string
  value: string
}

export type HistoryRowEdit =
  | { kind: 'transaction'; transaction: Transaction }
  | { kind: 'transfer'; target: TransferEditTarget }

export interface HistoryRow {
  id: string
  kind: HistoryRowKind
  title: string
  subtitle: string
  amount: string
  amountTone: HistoryAmountTone
  secondary: string
  details: HistoryRowDetail[]
  edit: HistoryRowEdit | null
  deleteId: string
  isTransferDelete: boolean
  // Posicion en el historial completo (todos los dias): escalona la entrada animada.
  order: number
}

export interface HistoryGroup {
  key: string
  label: string
  // null cuando algun movimiento del dia no tiene valor en USD conocido.
  net: string | null
  rows: HistoryRow[]
}

function dayKey(occurredAt: string): string {
  const date = new Date(occurredAt)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatSignedUsd(value: number): string {
  const sign = value < 0 ? '-' : '+'
  return `${sign}${formatCurrency(Math.abs(value), 'USD')}`
}

export function useTransactionHistory(
  transactions: MaybeRefOrGetter<Transaction[]>,
  wallets: MaybeRefOrGetter<Wallet[]>,
  fallbackCurrency: MaybeRefOrGetter<string> = 'USD',
) {
  const expandedId = ref<string | null>(null)
  const confirmingDeleteId = ref<string | null>(null)

  function currencyFor(transaction: Transaction): string {
    return (
      toValue(wallets).find((wallet) => wallet.id === transaction.walletId)?.currency ?? toValue(fallbackCurrency)
    )
  }

  function walletName(walletId: string): string {
    return toValue(wallets).find((wallet) => wallet.id === walletId)?.name ?? 'billetera eliminada'
  }

  // Valor en USD de un movimiento, o null si no se conoce (wallet en otra moneda
  // sin referencia congelada) - nunca se suman montos crudos de monedas distintas.
  function usdValue(transaction: Transaction): number | null {
    if (transaction.referenceAmountUsd !== null) return transaction.referenceAmountUsd
    return currencyFor(transaction) === 'USD' ? transaction.amount : null
  }

  function dateDetail(occurredAt: string): HistoryRowDetail {
    return { label: 'Fecha', value: `${formatDate(occurredAt)}, ${formatTime(occurredAt)}` }
  }

  function singleRow(transaction: Transaction): HistoryRow {
    const isTransferLeg = transaction.source === 'transfer'
    const kind: HistoryRowKind = isTransferLeg ? 'transfer' : transaction.type
    const wallet = walletName(transaction.walletId)
    const sign = isTransferLeg ? '' : transaction.type === 'expense' ? '-' : '+'
    const details: HistoryRowDetail[] = [dateDetail(transaction.occurredAt), { label: 'Billetera', value: wallet }]
    if (transaction.description) details.push({ label: 'Descripción', value: transaction.description })
    if (transaction.referenceAmountUsd !== null) {
      details.push({ label: 'Valor al momento', value: `≈ ${formatCurrency(transaction.referenceAmountUsd, 'USD')}` })
      if (transaction.referenceRate != null) {
        details.push({
          label: 'Tasa usada',
          value: `${formatCurrency(transaction.referenceRate, currencyFor(transaction))} por USD · ${formatDate(transaction.occurredAt)}`,
        })
      }
    }
    return {
      id: transaction.id,
      kind,
      title: transaction.category,
      subtitle: transaction.description ? `${transaction.description} · ${wallet}` : wallet,
      amount: `${sign}${formatCurrency(transaction.amount, currencyFor(transaction))}`,
      amountTone: transaction.type === 'expense' && !isTransferLeg ? 'expense' : 'neutral',
      secondary:
        transaction.referenceAmountUsd !== null ? `≈ ${formatCurrency(transaction.referenceAmountUsd, 'USD')}` : '',
      details,
      // Nunca sobre UNA pata suelta de transferencia: el backend la rechaza.
      edit: transaction.transferId === null ? { kind: 'transaction', transaction } : null,
      deleteId: transaction.id,
      isTransferDelete: transaction.transferId !== null,
      order: 0,
    }
  }

  function transferRow(item: Extract<TransactionListItem, { kind: 'transfer' }>): HistoryRow {
    const fee = item.feeLeg
    const details: HistoryRowDetail[] = [
      dateDetail(item.occurredAt),
      { label: 'Origen', value: walletName(item.fromLeg.walletId) },
      { label: 'Destino', value: walletName(item.toLeg.walletId) },
    ]
    if (fee) details.push({ label: 'Comisión', value: formatCurrency(fee.amount, currencyFor(fee)) })
    return {
      id: item.transferId,
      kind: 'transfer',
      title: `${walletName(item.fromLeg.walletId)} → ${walletName(item.toLeg.walletId)}`,
      subtitle: transferSecondaryText(item, currencyFor),
      amount: fee
        ? `-${formatCurrency(fee.amount, currencyFor(fee))}`
        : formatCurrency(item.fromLeg.amount, currencyFor(item.fromLeg)),
      amountTone: fee ? 'expense' : 'neutral',
      secondary: fee ? 'comisión' : '',
      details,
      edit: { kind: 'transfer', target: transferEditTarget(item, currencyFor) },
      deleteId: item.fromLeg.id,
      isTransferDelete: true,
      order: 0,
    }
  }

  // Aporte de un item al neto del dia, en USD: null = valor desconocido.
  // Las transferencias entre wallets propias solo cuentan por su comision.
  function netContribution(item: TransactionListItem): number | null {
    if (item.kind === 'transfer') {
      if (!item.feeLeg) return 0
      const fee = usdValue(item.feeLeg)
      return fee === null ? null : -fee
    }
    const transaction = item.transaction
    if (transaction.source === 'transfer') return 0
    const value = usdValue(transaction)
    if (value === null) return null
    return transaction.type === 'expense' ? -value : value
  }

  const groups = computed<HistoryGroup[]>(() => {
    const result: { group: HistoryGroup; net: number | null }[] = []
    const byKey = new Map<string, { group: HistoryGroup; net: number | null }>()
    for (const item of mergeTransferLegs(toValue(transactions))) {
      const occurredAt = item.kind === 'transfer' ? item.occurredAt : item.transaction.occurredAt
      const key = dayKey(occurredAt)
      let entry = byKey.get(key)
      if (!entry) {
        entry = { group: { key, label: formatDayHeading(occurredAt), net: null, rows: [] }, net: 0 }
        byKey.set(key, entry)
        result.push(entry)
      }
      entry.group.rows.push(item.kind === 'transfer' ? transferRow(item) : singleRow(item.transaction))
      const contribution = netContribution(item)
      entry.net = entry.net === null || contribution === null ? null : entry.net + contribution
    }
    let order = 0
    return result.map(({ group, net }) => ({
      ...group,
      rows: group.rows.map((row) => ({ ...row, order: order++ })),
      net: net === null ? null : formatSignedUsd(net),
    }))
  })

  function toggleRow(id: string) {
    expandedId.value = expandedId.value === id ? null : id
    confirmingDeleteId.value = null
  }

  function requestDelete(id: string) {
    confirmingDeleteId.value = id
  }

  function cancelDelete() {
    confirmingDeleteId.value = null
  }

  return { groups, expandedId, confirmingDeleteId, toggleRow, requestDelete, cancelDelete }
}
