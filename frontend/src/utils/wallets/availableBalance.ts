import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'

// Saldo real menos lo ya comprometido en aportes de OTRAS metas activas - pedido
// explicito del usuario: mostrar, ademas del saldo real de siempre, un "disponible"
// que evita comprometer dos veces la misma plata. `commitments` es el mapa
// walletId -> monto comprometido (ver useGoals().walletCommitments).
export function availableBalance(wallet: Wallet, commitments: Record<string, number>): number {
  return wallet.balance - (commitments[wallet.id] ?? 0)
}
