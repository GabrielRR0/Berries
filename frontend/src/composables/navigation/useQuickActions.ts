import { watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

// Acciones rapidas que abren algo en OTRA pantalla: hoy solo "Transferir" de
// Inicio, cuyo sheet vive en Cuentas. (Registrar, voz y escanear ya no pasan
// por aca: abren el panel global de composables/quickRegister/ sin navegar.)
// Quien dispara y quien abre no se conocen entre si - se comunican por un
// query param de la ruta, asi funciona igual aunque la pantalla destino
// todavia no este montada (el paginador solo monta de antemano a las vecinas
// de la activa).
export type QuickAction = 'transferir'

const QUICK_ACTION_QUERY = 'accion'

const ACTION_ROUTE: Record<QuickAction, string> = {
  transferir: 'cuentas',
}

export function quickActionLocation(action: QuickAction): RouteLocationRaw {
  return { name: ACTION_ROUTE[action], query: { [QUICK_ACTION_QUERY]: action } }
}

// Lado de la pantalla que abre: llama al handler de la accion que trae la
// ruta (si esta pantalla tiene uno) y limpia el query enseguida, para que
// recargar o volver atras no vuelva a abrirlo. Una accion ajena se ignora
// sin tocar la ruta - la limpia la pantalla que si la maneja.
export function useOnQuickAction(handlers: Partial<Record<QuickAction, () => void>>): void {
  const route = useRoute()
  const router = useRouter()

  watch(
    () => route.query[QUICK_ACTION_QUERY],
    (value) => {
      const handler = handlers[value as QuickAction]
      if (!handler) return
      handler()
      router.replace({ query: {} })
    },
    { immediate: true },
  )
}
