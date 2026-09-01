// Formas publicas del dominio debts - lo que composables/componentes conocen
// y usan. La forma "sobre el cable" (InstallmentWire/DebtWire/
// DebtSummaryWire) y DebtsApiError son detalle de implementacion de
// debts.service.ts.
export type DebtDirection = 'owed_by_user' | 'owed_to_user'
export type InstallmentStatus = 'pending' | 'paid'

export interface Installment {
  id: string
  debtId: string
  dueDate: string
  amount: number
  status: InstallmentStatus
  paidAt: string | null
}

export interface DebtPayment {
  id: string
  debtId: string
  amount: number
  currency: string
  appliedAmount: number
  note: string | null
  paidAt: string
  walletId: string | null
  createdAt: string
}

export interface Debt {
  id: string
  userId: string
  counterpartyName: string
  direction: DebtDirection
  totalAmount: number
  currency: string
  description: string | null
  createdAt: string
  installments: Installment[]
  payments: DebtPayment[]
  amountPaid: number
  remainingAmount: number
}

export interface CreateDebtPaymentInput {
  amount: number
  currency: string
  appliedAmount?: number
  note?: string
  paidAt?: string
  walletId?: string
}

export interface DebtPaymentVoicePreview {
  amount: number | null
  currency: string
  paidAt: string
  note: string
}

export interface DebtSummary {
  totalOwedByUser: number
  totalOwedToUser: number
}

export interface CreateDebtInput {
  counterpartyName: string
  direction: DebtDirection
  totalAmount: number
  currency: string
  description?: string
  installmentCount?: number
  firstDueDate?: string
  frequencyDays?: number
}
