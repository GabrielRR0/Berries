// Tipos publicos de TransactionsFilterSheet.vue - lo unico que ese
// componente exporta para que otro archivo lo use (TransactionsMain.vue).
// El resto de su estado (draftType, draftPeriod, etc.) es privado del
// componente y no vive aca.
// "transfer" filtra por source==="transfer" (las patas de una transferencia
// entre wallets propias), no por Transaction.type - ver TransactionsMain.vue.
export type TransactionTypeFilter = 'all' | 'income' | 'expense' | 'transfer'
export type TransactionPeriodFilter = 'month' | '7' | '15' | '30'

export interface TransactionsFilterState {
  type: TransactionTypeFilter
  period: TransactionPeriodFilter
  category: string | null
}
