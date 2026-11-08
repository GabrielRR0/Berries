import type { StatementProfile } from './types'

// Banco de Venezuela, estado de cuenta de "BDVenlinea personas": una tabla con Fecha, Referencia, Descripcion,
// "Debito / Credito" (una sola columna de tipo), Monto y Saldo, en bolivares y con cifras como "-25.000,00".
// Es el unico banco probado hasta ahora; los demas se agregan como otro archivo en esta carpeta.
export const BDV_PROFILE: StatementProfile = {
  id: 'bdv',
  label: 'Banco de Venezuela',
  description: 'Estado de cuenta de BDVenlínea personas, en bolívares.',
  currency: 'VEF',
  numberLocale: 'es',
  amountShape: /^-?\d[\d.]*,\d{2}$/,
  referenceShape: /^\d{8,}$/,
  referenceInCell: /\d{6,}/,
  debitWord: /debito|cargo|retiro/,
  creditWord: /credito|abono|deposito/,
  typeWord: /^(debito|credito)$/,
  typeWordStart: /^(deb|cred|cargo|abono)/,
  typeWordGlobal: /\b(debito|credito)\b/g,
  // Ej.: 0210086173620 (comision) y 0677286173620 (operacion) terminan igual: el banco las genera juntas.
  feeReferenceSuffixDigits: 7,
  kindSignals: [/\bfecha\b/, /\b(descripcion|concepto|detalle)\b/, /\b(monto|importe|debito|credito|cargo|abono)\b/],
  minDatesWithTitles: 2,
  minRowsWithoutTitles: 3,
}
