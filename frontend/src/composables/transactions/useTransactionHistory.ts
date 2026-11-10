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

// Modo "billetera" (cartola, ver WalletStatementMain.vue): la lista es de UNA billetera, asi
// que cada fila es un movimiento suelto (las dos patas de una transferencia viven en
// billeteras distintas y no se fusionan), con el saldo que dejo. Una pata de transferencia
// sigue siendo editable: se resuelve con la transferencia completa.
export interface WalletHistoryOptions {
  // Todos los movimientos del usuario: hacen falta para armar la transferencia completa de una pata.
  allTransactions: MaybeRefOrGetter<Transaction[]>
  // Saldo de la billetera antes y despues de cada movimiento (por id).
  balances: MaybeRefOrGetter<Map<string, { before: number; after: number }>>
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  voice: 'Voz',
  ocr: 'Foto de recibo',
  screenshot: 'Captura',
  bank: 'Banco',
  transfer: 'Transferencia',
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
  walletMode?: WalletHistoryOptions,
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

  // Pata de transferencia -> la transferencia completa (para editarla), solo en modo billetera.
  function transferEditFor(transaction: Transaction): HistoryRowEdit | null {
    if (!walletMode || transaction.transferId === null) return null
    const merged = mergeTransferLegs(toValue(walletMode.allTransactions)).find(
      (item) => item.kind === 'transfer' && item.transferId === transaction.transferId,
    )
    if (!merged || merged.kind !== 'transfer') return null
    return { kind: 'transfer', target: transferEditTarget(merged, currencyFor) }
  }

  function typeLabel(transaction: Transaction): string {
    if (transaction.source === 'transfer') return 'Transferencia'
    return transaction.type === 'expense' ? 'Gasto' : 'Ingreso'
  }

  function singleRow(transaction: Transaction): HistoryRow {
    const isTransferLeg = transaction.source === 'transfer'
    const kind: HistoryRowKind = isTransferLeg ? 'transfer' : transaction.type
    const wallet = walletName(transaction.walletId)
    // En modo billetera todo movimiento resta o suma saldo: siempre lleva signo.
    const sign = isTransferLeg && !walletMode ? '' : transaction.type === 'expense' ? '-' : '+'
    const currency = currencyFor(transaction)
    const balance = walletMode ? toValue(walletMode.balances).get(transaction.id) : undefined
    const details: HistoryRowDetail[] = [
      dateDetail(transaction.occurredAt),
      { label: 'Tipo', value: typeLabel(transaction) },
      { label: 'Categoría', value: transaction.category },
      { label: 'Monto', value: formatCurrency(transaction.amount, currency) },
      { label: 'Billetera', value: wallet },
    ]
    if (balance) {
      details.push(
        { label: 'Saldo antes', value: formatCurrency(balance.before, currency) },
        { label: 'Saldo después', value: formatCurrency(balance.after, currency) },
      )
    }
    details.push({ label: 'Origen', value: SOURCE_LABELS[transaction.source] ?? transaction.source })
    if (transaction.description) details.push({ label: 'Descripción', value: transaction.description })
    if (transaction.referenceAmountUsd !== null) {
      details.push({ label: 'Valor al momento', value: `≈ ${formatCurrency(transaction.referenceAmountUsd, 'USD')}` })
      if (transaction.referenceRate != null) {
        details.push({
          label: 'Tasa usada',
          value: `${formatCurrency(transaction.referenceRate, currency)} por USD · ${formatDate(transaction.occurredAt)}`,
        })
      }
    }
    return {
      id: transaction.id,
      kind,
      title: transaction.category,
      subtitle: transaction.description ? `${transaction.description} · ${wallet}` : wallet,
      amount: `${sign}${formatCurrency(transaction.amount, currency)}`,
      amountTone: transaction.type === 'expense' && (walletMode || !isTransferLeg) ? 'expense' : 'neutral',
      secondary: balance
        ? `Saldo ${formatCurrency(balance.after, currency)}`
        : transaction.referenceAmountUsd !== null
          ? `≈ ${formatCurrency(transaction.referenceAmountUsd, 'USD')}`
          : '',
      details,
      // Una pata suelta de transferencia solo se edita con la transferencia completa (modo billetera).
      edit: transaction.transferId === null ? { kind: 'transaction', transaction } : transferEditFor(transaction),
      deleteId: transaction.id,
      isTransferDelete: transaction.transferId !== null,
      order: 0,
    }
  }

  function transferRow(item: Extract<TransactionListItem, { kind: 'transfer' }>): HistoryRow {
    const fee = item.feeLeg
    const details: HistoryRowDetail[] = [
      dateDetail(item.occurredAt),
      { label: 'Tipo', value: 'Transferencia' },
      { label: 'Origen', value: walletName(item.fromLeg.walletId) },
      { label: 'Destino', value: walletName(item.toLeg.walletId) },
      { label: 'Monto enviado', value: formatCurrency(item.fromLeg.amount, currencyFor(item.fromLeg)) },
      { label: 'Monto recibido', value: formatCurrency(item.toLeg.amount, currencyFor(item.toLeg)) },
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
    const items: TransactionListItem[] = walletMode
      ? toValue(transactions).map((transaction) => ({ kind: 'single', transaction }))
      : mergeTransferLegs(toValue(transactions))
    for (const item of items) {
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
      // La cartola muestra saldos por fila; el neto en USD no aplica a una sola billetera.
      net: walletMode || net === null ? null : formatSignedUsd(net),
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
