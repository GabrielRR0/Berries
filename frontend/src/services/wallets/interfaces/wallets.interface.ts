// Formas publicas del dominio wallets - lo que stores/componentes conocen y
// usan. La forma "sobre el cable" (WalletWire/TransferResultWire) y
// WalletsApiError son detalle de implementacion de wallets.service.ts.
export interface Wallet {
  id: string
  name: string
  currency: string
  balance: number
  createdAt: string
}

export interface TransferParams {
  fromWalletId: string
  toWalletId: string
  amount: number
  fee?: number
  // Requerido solo cuando from/to tienen moneda distinta - el backend
  // responde 400 si falta en ese caso (ver TransferForm.vue).
  convertedAmount?: number
  // undefined = "ahora" (el backend resuelve el default) - pedido explicito
  // del usuario: poder backdatear una transferencia igual que un movimiento
  // manual.
  occurredAt?: string
}

export interface TransferResult {
  fromWallet: Wallet
  toWallet: Wallet
}

// Edicion de una transferencia ya existente - pedido explicito del usuario
// ("que se pueda editar esto [la fecha] y también los montos"). A diferencia
// de TransferParams, occurredAt es obligatorio (mismo criterio de "todos los
// campos" que UpdateTransactionParams) y no incluye from/to wallet: cambiar
// las billeteras sigue requiriendo eliminar y recrear la transferencia.
export interface TransferUpdateParams {
  amount: number
  occurredAt: string
  fee?: number
  convertedAmount?: number
}

// Lo que TransactionList.vue conoce de una transferencia fusionada (sus dos
// patas + comision opcional, ver listItems en ese componente) y le hace
// falta a TransferForm.vue para abrir en modo edicion - vive aca (no en
// TransferForm.vue) para que TransactionList.vue no tenga que importar un
// componente de otro dominio solo por su tipo.
export interface TransferEditTarget {
  transferId: string
  fromWalletId: string
  toWalletId: string
  amount: number
  fee: number
  convertedAmount: number | null
  occurredAt: string
}
