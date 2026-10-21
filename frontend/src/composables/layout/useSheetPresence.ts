import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

// Cuantos sheets/paneles modales hay abiertos ahora mismo. La barra flotante
// (BottomTabBar.vue) se esconde mientras haya alguno: los sheets viven dentro
// de las paginas del paginador, que se mueven con un transform, y eso les
// crea su propio contexto de apilado - por mas z-index que tengan, quedan
// POR DEBAJO de la barra fija y esta les tapaba el pie (bug real reportado
// por el usuario). Esconderla, como hacen las apps nativas al presentar un
// modal, arregla todos los sheets de una sola vez.
const openSheets = ref(0)

export const isAnySheetOpen = computed(() => openSheets.value > 0)

// Para un componente que existe solo mientras esta abierto (BottomSheet.vue).
export function trackSheetPresence(): void {
  onMounted(() => {
    openSheets.value += 1
  })
  onBeforeUnmount(() => {
    openSheets.value -= 1
  })
}

// Para uno que siempre esta montado y se abre/cierra con una bandera.
export function trackPresenceWhile(active: Ref<boolean>): void {
  watch(active, (isActive, wasActive) => {
    if (isActive && !wasActive) openSheets.value += 1
    else if (!isActive && wasActive) openSheets.value -= 1
  })
  onBeforeUnmount(() => {
    if (active.value) openSheets.value -= 1
  })
}
