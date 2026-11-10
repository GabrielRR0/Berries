import { formatCurrency } from '../formatters/formatCurrency'
import type { StatsPeriod, TransferStats } from './transferStats'
import { statsPeriodCaption } from './transferStats'
import type { WalletFlow } from './walletFlow'

// Tarjetas de estadisticas de Cuentas y de la cartola (StatTiles.vue). Solo arman el texto:
// los numeros salen de transferStats.ts y walletFlow.ts.
export type StatTileIcon = 'swap' | 'fee' | 'percent' | 'list' | 'in' | 'out'

export interface StatTile {
  id: string
  label: string
  value: string
  hint: string
  icon: StatTileIcon
  // "accent" pinta el valor en el rojo de Berry (lo que sale: gastos y comisiones).
  tone: 'neutral' | 'accent'
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function formatPercent(value: number): string {
  return `${value < 10 ? value.toFixed(2) : value.toFixed(1)}%`
}

// Cuentas: todas las billeteras, en USD.
export function buildOverviewTiles(stats: TransferStats, movementCount: number, period: StatsPeriod): StatTile[] {
  const caption = statsPeriodCaption(period)
  const fee = formatCurrency(stats.feeUsd, 'USD')
  return [
    {
      id: 'transfers',
      label: 'Transferencias',
      value: String(stats.transferCount),
      hint: stats.transferCount === 0 ? `Ninguna ${caption}` : `Entre tus billeteras, ${caption}`,
      icon: 'swap',
      tone: 'neutral',
    },
    {
      id: 'fees',
      label: 'Comisiones',
      value: stats.feeUsdIsPartial ? `≥ ${fee}` : fee,
      hint: stats.feeCount === 0 ? 'Sin comisiones' : `En ${plural(stats.feeCount, 'transferencia', 'transferencias')}`,
      icon: 'fee',
      tone: 'accent',
    },
    {
      id: 'fee-percent',
      label: 'Comisión promedio',
      value: stats.feePercent === null ? '—' : formatPercent(stats.feePercent),
      hint: stats.feePercent === null ? 'Sin base para calcular' : 'De lo que moviste',
      icon: 'percent',
      tone: 'neutral',
    },
    {
      id: 'movements',
      label: 'Movimientos',
      value: String(movementCount),
      hint: 'Ingresos y gastos, sin transferencias',
      icon: 'list',
      tone: 'neutral',
    },
  ]
}

// Cartola: una billetera, en su propia moneda.
export function buildFlowTiles(flow: WalletFlow, stats: TransferStats, currency: string): StatTile[] {
  return [
    {
      id: 'income',
      label: 'Ingresos',
      value: formatCurrency(flow.income, currency),
      hint: flow.incomeCount === 0 ? 'Sin ingresos' : plural(flow.incomeCount, 'movimiento', 'movimientos'),
      icon: 'in',
      tone: 'neutral',
    },
    {
      id: 'expense',
      label: 'Gastos',
      value: formatCurrency(flow.expense, currency),
      hint: flow.expenseCount === 0 ? 'Sin gastos' : plural(flow.expenseCount, 'movimiento', 'movimientos'),
      icon: 'out',
      tone: 'accent',
    },
    {
      id: 'transfers',
      label: 'Transferencias',
      value: String(stats.transferCount),
      hint: `${stats.sentCount} enviadas · ${stats.receivedCount} recibidas`,
      icon: 'swap',
      tone: 'neutral',
    },
    {
      id: 'fees',
      label: 'Comisiones',
      value: formatCurrency(flow.fee, currency),
      hint: flow.feeCount === 0 ? 'Sin comisiones' : `En ${plural(flow.feeCount, 'transferencia', 'transferencias')}`,
      icon: 'fee',
      tone: 'accent',
    },
  ]
}
