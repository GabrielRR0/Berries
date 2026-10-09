import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { pickWallet } from './pickWallet'
import { walletNameHints } from './movementDictionary'
import type { ScanRow } from './movementRows'

export interface RowDefaultsContext {
  wallets: Wallet[]
  // Billetera elegida en el primer paso: donde ocurrieron los movimientos del banco.
  selectedWalletId: string
}

// Billetera de una fila del banco: la elegida en el primer paso si su moneda coincide con la
// de la captura; si no (ej. eligio una en bolivares pero la captura esta en dolares), la unica
// billetera que haya en la moneda de la captura; si hay varias, queda vacia.
function walletForBankRow(row: ScanRow, selected: Wallet | null, wallets: Wallet[]): string {
  if (selected && (!row.currency || selected.currency === row.currency)) return selected.id
  return pickWallet(wallets, row.currency)
}

// Rellena las billeteras de cada fila con lo que se puede deducir sin dudar; lo
// que queda vacio lo elige el usuario en la revision.
//  - Gasto / ingreso / pendiente de un banco: la billetera elegida en el primer paso.
//  - Transferencia: del lado donde entra o sale el dinero esta esa billetera, y del
//    otro lado la billetera en USDT (si hay una sola).
//  - Orden P2P: USDT <-> la billetera en bolivares elegida (o la unica en VEF).
export function applyRowDefaults(rows: ScanRow[], context: RowDefaultsContext): ScanRow[] {
  const selected = context.wallets.find((wallet) => wallet.id === context.selectedWalletId) ?? null
  // Si la billetera elegida es la de USDT, esa es la del otro lado de una operacion P2P.
  const usdtWalletId =
    selected?.currency === 'USDT' ? selected.id : pickWallet(context.wallets, 'USDT', walletNameHints('binance'))
  const bolivarWalletId = selected?.currency === 'VEF' ? selected.id : pickWallet(context.wallets, 'VEF')

  for (const row of rows) {
    if (row.source === 'bank') {
      if (row.walletId === '') row.walletId = walletForBankRow(row, selected, context.wallets)
      if (row.action === 'transfer') {
        if (row.direction === 'in') {
          row.toWalletId = row.toWalletId || row.walletId
          row.fromWalletId = row.fromWalletId || usdtWalletId
        } else {
          row.fromWalletId = row.fromWalletId || row.walletId
          row.toWalletId = row.toWalletId || usdtWalletId
        }
      }
    } else {
      // Orden P2P: vender USDT = salen USDT y entran Bs; comprar = al reves.
      if (row.direction === 'in') {
        row.fromWalletId = row.fromWalletId || usdtWalletId
        row.toWalletId = row.toWalletId || bolivarWalletId
      } else {
        row.fromWalletId = row.fromWalletId || bolivarWalletId
        row.toWalletId = row.toWalletId || usdtWalletId
      }
    }
  }
  return rows
}

export interface CategoryDefaults {
  // Categoria para todos los gastos de la captura (ej. "Mercado"); vacia = no asignar.
  expenseCategory: string
  incomeCategory: string
}

// Asigna la categoria elegida antes de subir la captura a los gastos e ingresos que todavia no
// tienen una. Nunca pisa la que ya tiene una fila (sugerida o editada por el usuario).
export function applyCategoryDefaults(rows: ScanRow[], defaults: CategoryDefaults): ScanRow[] {
  for (const row of rows) {
    if (row.category.trim() !== '') continue
    if (row.action === 'expense' && defaults.expenseCategory.trim()) row.category = defaults.expenseCategory.trim()
    if (row.action === 'income' && defaults.incomeCategory.trim()) row.category = defaults.incomeCategory.trim()
  }
  return rows
}
