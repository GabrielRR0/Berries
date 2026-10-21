import { ref, watch, type Ref } from 'vue'
import { convertAmount } from '../../services/currency/currency.service'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'

// Pedidos de conversion en vuelo, compartidos entre todas las instancias del
// composable: BalanceCard y el carrusel de "Mis cuentas" arrancan juntos en
// Inicio y piden la misma conversion por wallet - asi sale una sola llamada a
// red en vez de una por cada uno. Se borra apenas termina (nada de cache con
// TTL: un monto o una tasa que cambie tiene que verse al instante).
const inflight = new Map<string, Promise<number>>()

function convertedAmount(amount: number, from: string, to: string): Promise<number> {
  if (from === to) return Promise.resolve(amount)

  const key = `${from}>${to}:${amount}`
  const pending = inflight.get(key)
  if (pending) return pending

  const request = convertAmount(amount, from, to)
    .then((result) => result.convertedAmount)
    .finally(() => inflight.delete(key))
  inflight.set(key, request)
  return request
}

// Suma de los balances de todas las wallets convertidos a la moneda de
// visualizacion, mas el peso porcentual de cada una sobre ese total. Si la
// conversion de alguna wallet falla, esa wallet cuenta como 0 (suma "best
// effort", no rompe toda la tarjeta - ver BalanceCard.vue) en vez de
// propagar el error. Una recalculacion nueva invalida a la anterior que
// siga en vuelo, para que una respuesta lenta no pise a una mas reciente.
export function useWalletsPortfolio(wallets: Ref<Wallet[]>, currency: Ref<string>) {
  const total = ref(0)
  const shares = ref<Record<string, number>>({})
  let latestRun = 0

  async function recompute() {
    const run = ++latestRun
    const target = currency.value

    const converted = await Promise.all(
      wallets.value.map(async (wallet) => {
        try {
          return [wallet.id, await convertedAmount(wallet.balance, wallet.currency, target)] as const
        } catch {
          return [wallet.id, 0] as const
        }
      }),
    )
    if (run !== latestRun) return

    const sum = converted.reduce((acc, [, value]) => acc + value, 0)
    total.value = sum
    shares.value = Object.fromEntries(
      converted.map(([id, value]) => [id, sum > 0 ? Math.round((value / sum) * 100) : 0]),
    )
  }

  watch([wallets, currency], recompute, { immediate: true })

  return { total, shares }
}
