import { ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { WalletStatement } from '../../services/wallets/interfaces/wallets.interface'
import { getWalletStatement } from '../../services/wallets/wallets.service'

// Estado de WalletStatementMain.vue: carga la cartola de la billetera `walletId` (se vuelve
// a cargar si cambia, o con reload() tras editar/eliminar un movimiento). Si falla, deja el
// mensaje en `error`. Al recargar conserva la cartola anterior para que la pantalla no parpadee.
export function useWalletStatement(walletId: MaybeRefOrGetter<string>) {
  const statement = ref<WalletStatement | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      statement.value = await getWalletStatement(toValue(walletId))
    } catch (cause) {
      statement.value = null
      error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la cartola.'
    } finally {
      isLoading.value = false
    }
  }

  watch(() => toValue(walletId), load, { immediate: true })

  return { statement, isLoading, error, reload: load }
}
