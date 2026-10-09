// Estado de cuenta en TABLA (por ejemplo "BDVenlinea personas" en la web): una fila por movimiento y una
// columna por dato. Cada banco los llama un poco distinto, asi que todo se reconoce por sinonimos; para
// otro banco normalmente basta agregar el sinonimo que usa. Texto en minusculas y sin tildes.

export type StatementColumn = 'date' | 'reference' | 'description' | 'amount' | 'balance' | 'debit' | 'credit'

// Como puede llamarse el titulo de cada columna (se compara al inicio de la palabra).
export const STATEMENT_COLUMN_SYNONYMS: Record<StatementColumn, RegExp[]> = {
  date: [/^fecha/],
  reference: [/^referencia/, /^ref$/, /^nro/, /^numero/, /^documento/, /^comprobante/],
  description: [/^descripcion/, /^concepto/, /^detalle/, /^observacion/],
  amount: [/^monto/, /^importe/, /^valor/],
  balance: [/^saldo/],
  debit: [/^debito/, /^cargo/, /^retiro/],
  credit: [/^credito/, /^abono/, /^deposito/],
}

// Como se reparten el debito y el credito en la tabla (se deduce de los titulos):
//  - 'typed':  una columna de monto y otra que dice "Debito / Credito" (BDV en linea);
//  - 'split':  dos columnas de monto, una de Debito (o Cargo) y otra de Credito (o Abono);
//  - 'signed': una sola columna de monto con signo (negativo = salio dinero).
export type StatementMode = 'typed' | 'split' | 'signed'

// Para reconocer la captura como un estado de cuenta: aparecen estos titulos (cada grupo es "cualquiera de")
// y varias fechas de fila. Se evita confundirlo con un comprobante suelto, que trae una sola fecha.
export const STATEMENT_KIND_SIGNALS: RegExp[] = [
  /\bfecha\b/,
  /\b(descripcion|concepto|detalle)\b/,
  /\b(monto|importe|debito|credito|cargo|abono)\b/,
]
export const MIN_STATEMENT_DATES = 3
export const STATEMENT_DATE_GLOBAL = /\d{2}[-/.]\d{2}[-/.]\d{4}/g

// Una fecha de fila ("20-09-2026" o "20/09/2026") y su hora ("19:58"), a veces separadas por un guion.
export const STATEMENT_DATE = /(\d{2})[-/.](\d{2})[-/.](\d{4})/
export const STATEMENT_TIME = /(\d{1,2}:\d{2})/

export const STATEMENT_DEBIT = /debito|cargo|retiro/
export const STATEMENT_CREDIT = /credito|abono|deposito/
// Inicio de la palabra de la columna de tipo (Debito / Credito), tolerante a una letra mal leida: se usa
// para ubicar cada fila (hay exactamente una por movimiento).
export const STATEMENT_DEBIT_OR_CREDIT_START = /^(deb|cred|cargo|abono)/

// Los estados de cuenta de estos bancos estan en bolivares.
export const STATEMENT_CURRENCY = 'VEF'
