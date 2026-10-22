import { ACCENT_PALETTES, DEFAULT_ACCENT_ID } from './accentPalettes'
import type { AccentId } from './accentPalettes'

// Donde se guarda el color principal elegido. HOY: localStorage del dispositivo.
// A FUTURO debe vivir en la base de datos (la tabla de usuarios aun no tiene
// columna para esto): cuando exista, solo hay que cambiar este modulo - leer el
// valor de /api/auth/me al iniciar sesion y escribirlo con un PATCH - sin tocar
// la pantalla ni el composable. Ver docs/accent-color-persistence.md.
const STORAGE_KEY = 'berry_accent_color'

function isAccentId(value: unknown): value is AccentId {
  return ACCENT_PALETTES.some((palette) => palette.id === value)
}

export function loadAccentPreference(): AccentId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isAccentId(stored) ? stored : DEFAULT_ACCENT_ID
  } catch {
    return DEFAULT_ACCENT_ID
  }
}

export function saveAccentPreference(id: AccentId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Sin storage (modo privado, cuota): el color sigue aplicado en esta sesion.
  }
}
