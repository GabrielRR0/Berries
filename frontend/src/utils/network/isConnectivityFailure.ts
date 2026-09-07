import { DebtsApiError } from '../../services/debts/debts.service'
import { CategoriesApiError } from '../../services/categories/categories.service'
import { GoalsApiError } from '../../services/goals/goals.service'
import { TransactionsApiError } from '../../services/transactions/transactions.service'
import { WalletsApiError } from '../../services/wallets/wallets.service'

// Un test que mockea uno de estos 5 modulos de servicio sin redeclarar su
// clase *ApiError deja ese import en `undefined` (para cualquier archivo que
// lo importe, no solo el que hizo el mock) - `instanceof undefined` tira en
// vez de devolver false. Tratar un constructor ausente como "no es esa
// clase" evita que un mock incompleto de OTRO dominio rompa la clasificacion
// de conectividad ademas de solo perder cobertura de ese caso puntual.
function isInstanceOf(err: unknown, ctor: unknown): boolean {
  return typeof ctor === 'function' && err instanceof ctor
}

// Distingue una falla de conexion real (el fetch nunca llego a golpear al
// backend - un TypeError crudo, u otro error sin tipar) de un rechazo
// LEGITIMO del backend (uno de los *ApiError tipados, que solo se lanzan
// DESPUES de una respuesta HTTP real). Antes vivia duplicada en
// offlineQueue.store.ts y useOfflineFallback.ts - un solo lugar ahora que
// tambien la necesitan los fetches de lectura (wallets/transactions/debts/
// goals/categorias) para decidir si mostrar la cache offline en vez de un
// error real.
export function isConnectivityFailure(err: unknown): boolean {
  return (
    !isInstanceOf(err, TransactionsApiError) &&
    !isInstanceOf(err, WalletsApiError) &&
    !isInstanceOf(err, DebtsApiError) &&
    !isInstanceOf(err, GoalsApiError) &&
    !isInstanceOf(err, CategoriesApiError)
  )
}
