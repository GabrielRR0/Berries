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
}

export interface TransferResult {
  fromWallet: Wallet
  toWallet: Wallet
}
