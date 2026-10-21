import { ref } from 'vue'
import type { Draft, Transaction } from '../../services/transactions/interfaces/transactions.interface'
import { useTransactionsStore } from '../../stores/transactions.store'
import { useWalletsStore } from '../../stores/wallets.store'
import { useQuickRegister } from './useQuickRegister'

// Lo que pasa DESPUES de elegir como registrar: un movimiento escrito a mano
// se guarda en la cache compartida (las pantallas ya abiertas lo reflejan
// solas), y lo que sale de voz o de un recibo es un borrador que el usuario
// revisa en el mismo panel antes de confirmarlo (mismo flujo que el sheet de
// Ingresos/Gastos de Inicio).
export function useQuickRegisterFlow() {
  const quickRegister = useQuickRegister()
  const transactionsStore = useTransactionsStore()
  const walletsStore = useWalletsStore()
  const drafts = ref<Draft[]>([])

  // El formulario y la revision de borradores necesitan las billeteras: si
  // el usuario abre el panel antes de que cargue ninguna pantalla, se piden.
  function ensureWallets() {
    if (walletsStore.wallets.length === 0) walletsStore.fetchWallets().catch(() => {})
  }

  function onTransactionCreated(transaction: Transaction) {
    transactionsStore.recordCreated(transaction)
    quickRegister.close()
  }

  // Sin conexion el formulario ya encolo el movimiento y avisa con un toast
  // (ver offlineQueue.store.ts): solo queda cerrar el panel.
  function onTransactionQueued() {
    quickRegister.close()
  }

  function onDraftCreated(draft: Draft) {
    ensureWallets()
    drafts.value = [draft, ...drafts.value]
    quickRegister.showDrafts()
  }

  function removeDraft(draftId: string) {
    drafts.value = drafts.value.filter((draft) => draft.id !== draftId)
    if (drafts.value.length === 0) quickRegister.close()
  }

  function onDraftConfirmed(transaction: Transaction, draftId: string) {
    transactionsStore.recordCreated(transaction)
    removeDraft(draftId)
  }

  return {
    drafts,
    ensureWallets,
    onTransactionCreated,
    onTransactionQueued,
    onDraftCreated,
    onDraftConfirmed,
    onDraftDiscarded: removeDraft,
  }
}
