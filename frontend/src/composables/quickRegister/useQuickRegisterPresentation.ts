import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { morphFromOrigin } from '../../animation/morphFromOrigin'
import { trackPresenceWhile } from '../layout/useSheetPresence'
import { useQuickRegister } from './useQuickRegister'

// Ciclo de vida visual del panel "Registrar": lo monta cuando se abre y
// espera a que termine la animacion de vuelta al boton antes de
// desmontarlo (un v-if directo cortaria la salida en seco). Tambien cierra
// con Escape y esconde la barra flotante mientras esta visible.
export function useQuickRegisterPresentation(panelRef: Ref<HTMLElement | null>) {
  const { isOpen, origin, closeOffsetY, close } = useQuickRegister()
  const rendered = ref(false)

  watch(isOpen, async (open) => {
    if (open) {
      rendered.value = true
      await nextTick()
      if (panelRef.value) morphFromOrigin(panelRef.value, origin.value, 'in')
      return
    }
    if (!rendered.value) return
    if (panelRef.value) await morphFromOrigin(panelRef.value, origin.value, 'out', closeOffsetY.value)
    rendered.value = false
  })

  trackPresenceWhile(rendered)

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen.value) close()
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

  return { rendered }
}
