import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createWallet,
  deleteWallet,
  listWallets,
  transferBetweenWallets,
  updateTransfer as updateTransferRequest,
} from '../services/wallets/wallets.service'
import type { TransferParams, TransferUpdateParams, Wallet } from '../services/wallets/interfaces/wallets.interface'
import { useTransactionsStore } from './transactions.store'

// Estado global/cross-cutting de wallets (lista de cuentas del usuario) -
// igual criterio que auth.store.ts: llama directo al service y guarda el
// estado reactivo el mismo, sin una capa de composable separada (a
// diferencia de currency, que si tiene composables/currency/useCurrency.ts
// porque esa conversion es un calculo puntual por componente, no estado
// compartido). Cada accion que muta re-sincroniza "wallets" contra el
// backend en vez de confiar en calculos locales de balance.
//
// Cache con TTL (pedido explicito del usuario: "guardar los datos cargados
// en cache... asi cuando nos movamos de un lado a otro ya los montos esten
// cargados, a menos que si requeria actualizar en casos concretos"): quien
// llama fetchWallets() ya no fuerza un fetch de red cada vez que un
// componente se monta (ej. BalanceCard.vue al volver a Inicio) - si los
// datos ya estan y todavia estan "frescos", se devuelve al instante.
// "force: true" es el escape para esos "casos concretos" (ver transfer()
// mas abajo, y transactions.store.ts, que lo pide tras crear/eliminar un
// movimiento porque eso cambia el balance real de una wallet).
const CACHE_TTL_MS = 2 * 60 * 1000

export const useWalletsStore = defineStore('wallets', () => {
  const wallets = ref<Wallet[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let lastFetchedAt: number | null = null
  // Si dos componentes llaman fetchWallets() casi al mismo tiempo antes de
  // que el primero resuelva, quien llega segundo espera la MISMA promesa
  // en vez de disparar su propio fetch duplicado (mismo bug real
  // encontrado y arreglado en transactions.store.ts).
  let inFlightFetch: Promise<void> | null = null

  function isFresh(): boolean {
    return lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS
  }

  function fetchWallets(options: { force?: boolean } = {}): Promise<void> {
    if (!options.force && wallets.value.length > 0 && isFresh()) return Promise.resolve()
    if (inFlightFetch) return inFlightFetch

    isLoading.value = true
    error.value = null
    inFlightFetch = (async () => {
      try {
        wallets.value = await listWallets()
        lastFetchedAt = Date.now()
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'No se pudieron cargar las billeteras.'
        throw err
      } finally {
        isLoading.value = false
        inFlightFetch = null
      }
    })()
    return inFlightFetch
  }

  async function addWallet(name: string, currency: string, initialBalance?: number): Promise<void> {
    error.value = null
    try {
      const wallet = await createWallet(name, currency, initialBalance)
      wallets.value = [...wallets.value, wallet]
      lastFetchedAt = Date.now()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'No se pudo crear la billetera.'
      throw err
    }
  }

  async function removeWallet(walletId: string): Promise<void> {
    error.value = null
    try {
      await deleteWallet(walletId)
      wallets.value = wallets.value.filter((wallet) => wallet.id !== walletId)
      lastFetchedAt = Date.now()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'No se pudo eliminar la billetera.'
      throw err
    }
  }

  // Tras una transferencia exitosa, se refresca la lista completa contra el
  // backend en vez de parchear los dos wallets localmente - mas simple y
  // evita que un calculo de balance en el cliente quede desincronizado del
  // ledger real. force:true porque acaba de cambiar de verdad, la cache
  // vieja ya no sirve. Tambien se fuerza el refresh de transactions.store -
  // el backend ahora registra la transferencia como dos movimientos (ver
  // transfer_service.py), asi que Movimientos/Historial deben reflejarlos
  // sin esperar a que expire su propio TTL.
  async function transfer(params: TransferParams): Promise<void> {
    error.value = null
    try {
      await transferBetweenWallets(params)
      await Promise.all([fetchWallets({ force: true }), useTransactionsStore().fetchTransactions({ force: true })])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'No se pudo completar la transferencia.'
      throw err
    }
  }

  // Edicion de una transferencia ya existente (monto/comision/fecha) - pedido
  // explicito del usuario. Mismo criterio de refresco que transfer(): fuerza
  // wallets+transactions en vez de parchear localmente.
  async function updateTransfer(transferId: string, params: TransferUpdateParams): Promise<void> {
    error.value = null
    try {
      await updateTransferRequest(transferId, params)
      await Promise.all([fetchWallets({ force: true }), useTransactionsStore().fetchTransactions({ force: true })])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'No se pudo editar la transferencia.'
      throw err
    }
  }

  return { wallets, isLoading, error, fetchWallets, addWallet, removeWallet, transfer, updateTransfer }
})
