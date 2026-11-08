import type { StatementColumn, StatementMode } from '../dictionary/bankStatementLabels'
import type { ScanRow } from '../movementRows'
import type { BankId } from './profiles/types'

export type { StatementColumn, StatementMode }

// Lo que se le pasa a parseBankStatement junto con las palabras leidas por el OCR.
export interface BankStatementOptions {
  // Ancho de la imagen en pixeles (de ahi sale la tolerancia entre columnas).
  imageWidth: number
  // Fecha para una fila cuya fecha no se pudo leer.
  defaultDate: string | null
  // false = descartar las comisiones en vez de unirlas a su operacion.
  includeFees?: boolean
  // Banco elegido en Ajustes; sin valor se usa el de por defecto.
  bank?: BankId
}

// Donde empieza (x en pixeles) cada columna reconocida. Una columna que no se encontro queda sin valor.
// En 'typed' la columna "Debito / Credito" se guarda en `debit`.
export interface ColumnStarts {
  date?: number
  reference?: number
  description?: number
  amount?: number
  balance?: number
  debit?: number
  credit?: number
}

// Una columna con su inicio, para recorrer las que se encontraron.
export interface ColumnStart {
  column: StatementColumn
  start: number
}

// La tabla ya ubicada: variante, inicio de cada columna y donde terminan los titulos (y empieza el cuerpo).
export interface Columns {
  mode: StatementMode
  starts: ColumnStarts
  headerBottom: number
}

// Los limites verticales (y en pixeles) de una fila de la tabla.
export interface RowBounds {
  top: number
  bottom: number
}

// El texto de cada celda de una fila ('' si la celda quedo vacia).
export interface RowCells {
  date: string
  reference: string
  description: string
  amount: string
  balance: string
  debit: string
  credit: string
}

// Un numero leido de una celda: su valor sin signo y si traia el signo menos.
export interface ReadAmount {
  value: number
  negative: boolean
}

// Una fila leida, con lo que hace falta para comprobar el saldo del banco.
export interface Entry {
  row: ScanRow
  // Cuanto cambio el saldo: positivo si entro dinero, negativo si salio.
  signedAmount: number
  // El saldo que mostraba el banco despues del movimiento (null si no se leyo).
  balance: number | null
}
