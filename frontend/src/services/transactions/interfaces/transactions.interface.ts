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
  // Snapshot de la moneda de la wallet al crear/editar (ver transaction_model.py del
  // backend) - null solo en filas viejísimas que un backfill todavía no alcanzó a
  // rellenar. Fuente de verdad para saber en qué moneda está esta transacción, en vez
  // de tener que cruzar walletId contra la lista de wallets. Opcional (no solo
  // `| null`), mismo criterio que referenceRate más abajo: no forzar a tocar los specs
  // existentes que ya construyen un Transaction a mano sin este campo.
  currency?: string | null
  // Valor congelado en USD al momento de crear la transacción (ver
  // create_transaction del backend) - null si la wallet ya estaba en USD, o si la
  // conversión falló en su momento. Pedido explícito del usuario: para una wallet en
  // una moneda nacional con inflación fuerte (VEF, COP, ARS...) quiere un registro FIJO
  // de "cuánto era eso ese día", que nunca cambie con el paso del tiempo - a diferencia
  // de convertir "amount" en vivo con la tasa de HOY (ver TransactionList.vue).
  referenceAmountUsd: number | null
  // Tasa congelada junto con referenceAmountUsd (moneda de la wallet por USD, ej. "Bs
  // por USD") - para poder mostrarle al usuario a qué tasa se calculó, no solo el
  // resultado ya convertido. Opcional (no solo `| null`): filas creadas antes de que
  // este campo existiera en el backend no lo traen en absoluto.
  referenceRate?: number | null
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

export interface UpdateTransactionParams {
  walletId: string
  type: TransactionType
  amount: number
  category: string
  description?: string
  occurredAt: string
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
