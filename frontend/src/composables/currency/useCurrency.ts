import { ref } from 'vue'
import { convertAmount } from '../../services/currency/currency.service'
import type { ConversionResult } from '../../services/currency/interfaces/currency.interface'

// Envuelve currency.service.ts con refs reactivas de loading/error - patron
// de composable para dominios que no son estado global compartido (a
// diferencia de wallets/currency.store.ts, la conversion puntual de un monto
// es algo que cada componente dispara por su cuenta, ver BalanceCard.vue).
// El error se guarda en "conversionError" para bindear en la UI Y se
// re-lanza, para que quien llama (ej. una suma best-effort) decida si lo
// atrapa por-conversion o deja que rompa el flujo.
export function useCurrency() {
  const isConverting = ref(false)
  const conversionError = ref<string | null>(null)

  async function convert(amount: number, from: string, to: string): Promise<ConversionResult> {
    isConverting.value = true
    conversionError.value = null
    try {
      return await convertAmount(amount, from, to)
    } catch (err) {
      conversionError.value = err instanceof Error ? err.message : 'No se pudo convertir el monto.'
      throw err
    } finally {
      isConverting.value = false
    }
  }

  return { isConverting, conversionError, convert }
}
