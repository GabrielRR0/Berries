import type { Entry } from './types'

// Comprobar la lectura con el saldo del banco. Recibe las filas en el orden de la tabla y marca (en sus
// `flags`) las que no cuadran. No devuelve nada: modifica las filas.
const BALANCE_TOLERANCE = 0.011
const BALANCE_FLAG = 'El saldo del banco no cuadra con este movimiento: revisa el monto.'

// La lista va de lo mas nuevo a lo mas viejo, asi que el saldo de una fila debe ser el saldo de la siguiente
// MAS su movimiento (con signo). Si no cuadra, el OCR leyo mal algun numero y la fila se marca.
export function checkBalanceChain(entries: Entry[]): void {
  for (let index = 0; index < entries.length - 1; index++) {
    const current = entries[index]!
    const previous = entries[index + 1]!
    if (current.balance === null || previous.balance === null) continue
    if (Math.abs(previous.balance + current.signedAmount - current.balance) > BALANCE_TOLERANCE) {
      current.row.flags.push(BALANCE_FLAG)
    }
  }
}
