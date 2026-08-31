// Formas publicas del dominio transactions - lo que stores/composables/
// componentes conocen y usan (incluye consumidores de otros dominios:
// voiceEntry/receiptScanner devuelven un Draft, ver sus propios services).
// La forma "sobre el cable" (TransactionWire/DraftWire) y
// TransactionsApiError son detalle de implementacion de
// transactions.service.ts.
export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  walletId: string
  type: TransactionType
  amount: number
  category: string
  description: string | null
  occurredAt: string
  source: string
  // No nulo solo en las dos patas (expense+income) que crea una transferencia entre
  // wallets propias - ver transfer_service.py del backend. Comparten el mismo valor
  // entre si, y con ninguna otra transaction.
  transferId: string | null
  createdAt: string
}

export interface CreateTransactionParams {
  walletId: string
  type: TransactionType
  amount: number
  category: string
  description?: string
  occurredAt?: string
  source?: string
}

export interface ListTransactionsParams {
  walletId?: string
  category?: string
  dateFrom?: string
  dateTo?: string
}

export interface Draft {
  id: string
  source: string
  rawInput: string | null
  parsedAmount: number | null
  parsedCurrency: string | null
  parsedCategory: string | null
  parsedDescription: string | null
  // Solo viene poblado cuando el dictado menciono una wallet real del usuario junto a
  // una frase de "use todo el saldo" (ver full_balance_detector.py del backend) - en
  // ese caso parsedAmount/parsedCurrency ya vienen sobreescritos con el balance real
  // de esa wallet.
  suggestedWalletId: string | null
  status: string
  createdAt: string
}

export interface ConfirmDraftParams {
  walletId: string
  type: TransactionType
  finalAmount: number
  finalCategory: string
  finalDescription?: string
}
