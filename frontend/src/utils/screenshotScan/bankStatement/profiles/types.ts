import type { NumberLocale } from '../../types'

// Perfil de un banco para leer su estado de cuenta en tabla. El motor (bankStatement/) no sabe de bancos:
// todo lo que cambia de un banco a otro vive aqui. Para agregar un banco: ver dictionary/README.md.

// Bancos que se pueden elegir en Ajustes. Al sumar uno, se agrega aqui y en profiles/index.ts.
export type BankId = 'bdv'

export interface StatementProfile {
  // Identificador guardado en la preferencia del usuario.
  id: BankId
  // Nombre que se muestra en Ajustes.
  label: string
  // Moneda de todos los movimientos de este banco (codigo de la app, por ejemplo 'VEF').
  currency: string
  // Como se escriben las cifras: en espanol "1.006,51", en ingles "1,006.51".
  numberLocale: NumberLocale
  // Forma de un monto suelto ("-25.000,00"). Se usa para deducir columnas cuando faltan los titulos.
  amountShape: RegExp
  // Forma de una referencia completa en una sola palabra. Se usa cuando faltan los titulos.
  referenceShape: RegExp
  // Como sacar la referencia de dentro del texto de su celda.
  referenceInCell: RegExp
  // Palabra de la columna de tipo que significa que salio dinero (texto en minusculas y sin tildes).
  debitWord: RegExp
  // Palabra de la columna de tipo que significa que entro dinero.
  creditWord: RegExp
  // La palabra de tipo completa ("debito" o "credito"), para deducir columnas sin titulos.
  typeWord: RegExp
  // Inicio de la palabra de tipo, tolerante a una letra mal leida: ubica cada fila.
  typeWordStart: RegExp
  // La palabra de tipo dentro de todo el texto (con /g): cuenta cuantas filas trae la captura.
  typeWordGlobal: RegExp
  // Cuantas cifras finales de la referencia comparten una comision y su operacion.
  feeReferenceSuffixDigits: number
  // Titulos que delatan un estado de cuenta (cada uno es "cualquiera de" sus palabras).
  kindSignals: RegExp[]
  // Fechas de fila que bastan para reconocer la tabla cuando se ven los titulos.
  minDatesWithTitles: number
  // Fechas y palabras de tipo que bastan cuando la captura perdio los titulos (recortada).
  minRowsWithoutTitles: number
}
