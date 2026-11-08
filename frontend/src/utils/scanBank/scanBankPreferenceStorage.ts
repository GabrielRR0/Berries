import { DEFAULT_BANK_ID, toBankId } from '../screenshotScan/bankStatement'
import type { BankId } from '../screenshotScan/bankStatement'

// Donde se guarda el banco elegido para leer las capturas. HOY: localStorage del dispositivo.
// A FUTURO debe vivir en la base de datos (la tabla de usuarios aun no tiene columna para esto):
// cuando exista, solo hay que cambiar este modulo - leer el valor de /api/auth/me al iniciar sesion y
// escribirlo con un PATCH - sin tocar la pantalla ni el composable. Mismo patron que el color principal:
// ver docs/accent-color-persistence.md.
const STORAGE_KEY = 'berry_scan_bank'

// El banco guardado; sin nada guardado (o con un valor que ya no existe) el de por defecto.
export function loadScanBankPreference(): BankId {
  try {
    return toBankId(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_BANK_ID
  }
}

export function saveScanBankPreference(id: BankId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Sin storage (modo privado, cuota): el banco sigue elegido en esta sesion.
  }
}
