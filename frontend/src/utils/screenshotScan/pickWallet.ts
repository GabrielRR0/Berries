import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'

// Una billetera solo se preselecciona si no hay duda: la unica de esa moneda,
// o (si hay varias) la unica cuyo nombre menciona alguna de las pistas (ej. el
// banco). Con varias candidatas queda vacia para que el usuario elija.
export function pickWallet(wallets: Wallet[], currency: string | null, nameHints: string[] = []): string {
  if (currency === null) return ''
  const sameCurrency = wallets.filter((wallet) => wallet.currency === currency)
  if (sameCurrency.length === 1) return sameCurrency[0]!.id

  const byName = sameCurrency.filter((wallet) => nameHints.some((hint) => wallet.name.toLowerCase().includes(hint)))
  return byName.length === 1 ? byName[0]!.id : ''
}
