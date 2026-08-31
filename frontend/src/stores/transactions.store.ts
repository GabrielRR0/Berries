import { defineStore } from 'pinia'
import { ref } from 'vue'
import { deleteTransaction, listTransactions } from '../services/transactions/transactions.service'
import type { Transaction } from '../services/transactions/interfaces/transactions.interface'
import { useWalletsStore } from './wallets.store'

// Cache compartida de movimientos entre pantallas - pedido explicito del
// usuario ("guardar los datos cargados en cache... asi cuando nos movamos
// de un lado a otro ya los montos esten cargados, a menos que si requeria
// actualizar en casos concretos"). Antes cada pantalla que necesitaba
// movimientos (IncomeExpenseSummary.vue, BalanceTrendBackdrop.vue,
// TransactionsMain.vue) hacia su propio listTransactions() por separado,
// sin compartir nada entre si ni entre visitas a la misma pantalla.
//
// Se cachea la lista COMPLETA (sin filtro de fecha) en vez de cachear por
// cada combinacion de query params - quien necesita solo "este mes"
// filtra el array ya cargado en el propio componente. Mismo criterio de
// cache-con-TTL que wallets.store.ts.
const CACHE_TTL_MS = 2 * 60 * 1000

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref<Transaction[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let lastFetchedAt: number | null = null
  // Varios componentes de Inicio (BalanceTrendBackdrop.vue,
  // IncomeExpenseSummary.vue) llaman fetchTransactions() casi al mismo
  // tiempo al montar - sin este guard, ninguno de los dos ve todavia
  // "lastFetchedAt" resuelto y ambos disparan su propio fetch en paralelo
  // (confirmado viendo las requests de red reales contra el dev server).
  // Quien llegue segundo mientras el primero sigue en vuelo espera la
  // MISMA promesa en vez de duplicar la llamada.
  let inFlightFetch: Promise<void> | null = null

  function isFresh(): boolean {
    return lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS
  }

  function fetchTransactions(options: { force?: boolean } = {}): Promise<void> {
    if (!options.force && lastFetchedAt !== null && isFresh()) return Promise.resolve()
    if (inFlightFetch) return inFlightFetch

    isLoading.value = true
    error.value = null
    inFlightFetch = (async () => {
      try {
        transactions.value = await listTransactions()
        lastFetchedAt = Date.now()
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'No se pudieron cargar los movimientos.'
        throw err
      } finally {
        isLoading.value = false
        inFlightFetch = null
      }
    })()
    return inFlightFetch
  }

  // "Caso concreto" que si necesita actualizar de verdad (pedido explicito
  // del usuario): elimina contra el backend, saca el item de la cache y
  // fuerza un refresh de wallets.store.ts (el balance de esa wallet
  // cambio - de otra forma esa cache quedaria mostrando un balance viejo
  // hasta que expire el TTL).
  //
  // Si la transaction es una pata de transferencia (transferId no nulo -
  // ver transfer_service.py), el backend borra las DOS patas juntas
  // (transaction_service.delete_transaction) - hay que sacar tambien la
  // otra pata de la cache local aca, o quedaria mostrando un movimiento
  // que ya no existe en el backend hasta el proximo fetch forzado.
  async function removeTransaction(transactionId: string): Promise<void> {
    await deleteTransaction(transactionId)
    const deleted = transactions.value.find((transaction) => transaction.id === transactionId)
    transactions.value = transactions.value.filter((transaction) => {
      if (transaction.id === transactionId) return false
      if (deleted?.transferId && transaction.transferId === deleted.transferId) return false
      return true
    })
    lastFetchedAt = Date.now()
    await useWalletsStore().fetchWallets({ force: true })
  }

  // TransactionForm.vue/DraftReviewCard.vue ya hacen la llamada de red de
  // creacion/confirmacion ellos mismos (son compartidos entre
  // Movimientos e Inicio) - esto NO repite esa llamada, solo sincroniza
  // la cache local con el resultado que ya emitieron y fuerza el refresh
  // de wallets, otro de los "casos concretos" (crear un movimiento cambia
  // el balance real de una wallet).
  function recordCreated(transaction: Transaction): void {
    transactions.value = [transaction, ...transactions.value]
    lastFetchedAt = Date.now()
    useWalletsStore().fetchWallets({ force: true })
  }

  return { transactions, isLoading, error, fetchTransactions, removeTransaction, recordCreated }
})
