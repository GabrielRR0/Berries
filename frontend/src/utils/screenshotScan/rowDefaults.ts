import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { pickWallet } from './pickWallet'
import { walletNameHints } from './movementDictionary'
import type { ScanRow } from './movementRows'

export interface RowDefaultsContext {
  wallets: Wallet[]
  // Billetera elegida en el primer paso: donde ocurrieron los movimientos del banco.
  selectedWalletId: string
}

// Rellena las billeteras de cada fila con lo que se puede deducir sin dudar; lo
// que queda vacio lo elige el usuario en la revision.
//  - Gasto / ingreso / pendiente de un banco: la billetera elegida en el primer paso.
//  - Transferencia: del lado donde entra o sale el dinero esta esa billetera, y del
//    otro lado la billetera en USDT (si hay una sola).
//  - Orden P2P: USDT <-> la billetera en bolivares elegida (o la unica en VEF).
export function applyRowDefaults(rows: ScanRow[], context: RowDefaultsContext): ScanRow[] {
  const selected = context.wallets.find((wallet) => wallet.id === context.selectedWalletId) ?? null
  const usdtWalletId = pickWallet(context.wallets, 'USDT', walletNameHints('binance'))
  const bolivarWalletId = selected?.currency === 'VEF' ? selected.id : pickWallet(context.wallets, 'VEF')

  for (const row of rows) {
    if (row.source === 'bank') {
      if (row.walletId === '') row.walletId = context.selectedWalletId
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
