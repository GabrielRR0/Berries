import { computed, ref } from 'vue'
import { BANK_OPTIONS, getProfile } from '../../utils/screenshotScan/bankStatement'
import type { BankId } from '../../utils/screenshotScan/bankStatement'
import { loadScanBankPreference, saveScanBankPreference } from '../../utils/scanBank/scanBankPreferenceStorage'

// Banco elegido en Ajustes para leer las capturas. Estado a nivel de MODULO (lo leen la pantalla de
// Ajustes, el menu y el registro desde capturas, que no son padre/hijo). La persistencia vive en
// utils/scanBank/scanBankPreferenceStorage.ts; de que cambia de un banco a otro, en
// utils/screenshotScan/bankStatement/profiles/.
const bankId = ref<BankId>(loadScanBankPreference())

export function useScanBank() {
  const bankLabel = computed(() => getProfile(bankId.value).label)

  function setBank(id: BankId): void {
    if (id === bankId.value) return
    bankId.value = id
    saveScanBankPreference(id)
  }

  return { bankId, bankLabel, bankOptions: BANK_OPTIONS, setBank }
}
