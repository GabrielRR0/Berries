import type { ScanRow } from './movementRows'
import type { ScanScope } from './rowsFromImage'

// Que clase de transferencia es (solo cuando se elige "Transferencias"):
//  - 'p2p': una operacion P2P de Binance (se vende o compra USDT por bolivares). Los movimientos del
//    banco quedan pendientes de enlazar con su orden, que es la que trae los USDT.
//  - 'other': cualquier otro movimiento de dinero entre cuentas propias (por ejemplo, darle dolares
//    de Facebank a un amigo que te los cambia a USDT). Cada movimiento es una transferencia desde
//    la billetera elegida; el usuario indica a cual llego y cuanto.
export type TransferKind = 'p2p' | 'other'

// Contexto que el usuario elige antes de subir las capturas ("que es lo que voy a registrar").
// Es opcional: con 'all' las filas quedan como se leyeron.
export interface ScanContext {
  scope: ScanScope
  // Solo se usa con scope 'transfers'; sin valor se toma 'p2p'.
  transferKind?: TransferKind
}

// Una transferencia mueve dinero entre cuentas del propio usuario: nunca es un gasto ni un ingreso.
// Por eso:
//  - "solo gastos" / "solo ingresos": las ordenes P2P (que son transferencias) no aplican y se dejan fuera;
//  - "Transferencias": ver TransferKind.
export function applyScanContext(rows: ScanRow[], context: ScanContext): ScanRow[] {
  const { scope } = context

  if (scope === 'expenses' || scope === 'received') {
    const wanted = scope === 'expenses' ? 'out' : 'in'
    return rows.filter((row) => row.source !== 'p2p_order' && row.direction === wanted)
  }

  if (scope === 'transfers') {
    const bankAction = (context.transferKind ?? 'p2p') === 'other' ? 'transfer' : 'pending'
    return rows.map((row) => {
      if (row.source === 'bank' && (row.action === 'income' || row.action === 'expense')) {
        return { ...row, action: bankAction, category: '' }
      }
      return row
    })
  }

  return rows
}
