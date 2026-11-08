// Estado de cuenta en TABLA (por ejemplo "BDVenlinea personas" en la web): una fila por movimiento y una
// columna por dato. Aqui va solo lo GENERICO del motor (nombres de columnas, fechas); lo que depende del
// banco (moneda, palabras de debito/credito, forma de las cifras) vive en un perfil:
// bankStatement/profiles/. Texto en minusculas y sin tildes.

export type StatementColumn = 'date' | 'reference' | 'description' | 'amount' | 'balance' | 'debit' | 'credit'

// Todas las columnas que reconoce el motor.
export const STATEMENT_COLUMNS: StatementColumn[] = ['date', 'reference', 'description', 'amount', 'balance', 'debit', 'credit']

// Como puede llamarse el titulo de cada columna (se compara al inicio de la palabra).
export const STATEMENT_COLUMN_SYNONYMS: Record<StatementColumn, RegExp[]> = {
  // Tesseract lee las ultimas letras de un titulo chico a su manera ("Monto" -> "Monte", "Saldo" -> "Salde"):
  // por eso se comparan las primeras letras y no la palabra entera.
  date: [/^fech/],
  reference: [/^referen/, /^ref$/, /^nro/, /^numero/, /^documento/, /^comprobante/],
  description: [/^descrip/, /^concepto/, /^detalle/, /^observacion/],
  amount: [/^mont/, /^import/, /^valor/],
  balance: [/^sald/],
  debit: [/^debit/, /^cargo/, /^retiro/],
  credit: [/^credit/, /^abon/, /^deposit/],
}

// Como se reparten el debito y el credito en la tabla (se deduce de los titulos):
//  - 'typed':  una columna de monto y otra que dice "Debito / Credito" (BDV en linea);
//  - 'split':  dos columnas de monto, una de Debito (o Cargo) y otra de Credito (o Abono);
//  - 'signed': una sola columna de monto con signo (negativo = salio dinero).
export type StatementMode = 'typed' | 'split' | 'signed'

// Una fecha dentro de todo el texto ("20-09-2026" o "20/09/2026"): cuenta cuantas filas trae la captura.
export const STATEMENT_DATE_GLOBAL = /\d{2}[-/.]\d{2}[-/.]\d{4}/g

// Una fecha de fila y su hora ("19:58"), a veces separadas por un guion.
export const STATEMENT_DATE = /(\d{2})[-/.](\d{2})[-/.](\d{4})/
export const STATEMENT_TIME = /(\d{1,2}:\d{2})/
