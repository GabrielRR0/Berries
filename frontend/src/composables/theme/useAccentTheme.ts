import { computed, ref } from 'vue'
import { prefersReducedMotion } from '../../animation/prefersReducedMotion'
import { ACCENT_PALETTES, accentCssVariables, findAccentPalette } from '../../utils/theme/accentPalettes'
import type { AccentId } from '../../utils/theme/accentPalettes'
import { loadAccentPreference, saveAccentPreference } from '../../utils/theme/accentPreferenceStorage'

// Color principal de la app. Estado a nivel de MODULO (lo lee Menu, la pantalla de
// Apariencia y el arranque en main.ts, que no son padre/hijo). Cambiarlo escribe las
// variables CSS del acento sobre <html>: toda la UI que usa --accent y derivados
// (ver style.css) cambia de una vez.
const accentId = ref<AccentId>(loadAccentPreference())

// Clase que activa, por un instante, una transicion de color global (style.css) para
// que el cambio de acento sea un fundido y no un salto.
const TRANSITION_CLASS = 'accent-transition'
const TRANSITION_MS = 450
let transitionTimer: ReturnType<typeof setTimeout> | null = null

function applyToDocument(id: AccentId, animated: boolean) {
  const root = document.documentElement
  if (animated && !prefersReducedMotion()) {
    root.classList.add(TRANSITION_CLASS)
    if (transitionTimer) clearTimeout(transitionTimer)
    transitionTimer = setTimeout(() => root.classList.remove(TRANSITION_CLASS), TRANSITION_MS)
  }
  for (const [name, value] of Object.entries(accentCssVariables(findAccentPalette(id)))) {
    root.style.setProperty(name, value)
  }
}

// Se llama una vez antes de montar la app: aplica el color guardado sin animacion.
export function initAccentTheme() {
  applyToDocument(accentId.value, false)
}

export function useAccentTheme() {
  const palette = computed(() => findAccentPalette(accentId.value))

  function setAccent(id: AccentId) {
    if (id === accentId.value) return
    accentId.value = id
    saveAccentPreference(id)
    applyToDocument(id, true)
  }

  return { accentId, palette, palettes: ACCENT_PALETTES, setAccent }
}
