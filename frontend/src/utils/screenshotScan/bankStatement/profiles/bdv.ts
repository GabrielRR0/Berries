import {
  BDV_AMOUNT_SHAPE,
  BDV_CREDIT_WORD,
  BDV_DEBIT_WORD,
  BDV_FEE_REFERENCE_SUFFIX_DIGITS,
  BDV_KIND_SIGNALS,
  BDV_MIN_DATES_WITH_TITLES,
  BDV_MIN_ROWS_WITHOUT_TITLES,
  BDV_REFERENCE_IN_CELL,
  BDV_REFERENCE_SHAPE,
  BDV_TYPE_WORD,
  BDV_TYPE_WORD_GLOBAL,
  BDV_TYPE_WORD_START,
} from '../../dictionary'
import type { StatementProfile } from './types'

// Banco de Venezuela, estado de cuenta de "BDVenlinea personas": una tabla con Fecha, Referencia, Descripcion,
// "Debito / Credito" (una sola columna de tipo), Monto y Saldo, en bolivares y con cifras como "-25.000,00".
// Es el unico banco probado hasta ahora. Este archivo solo ARMA el perfil: las palabras y formas que lo
// reconocen viven en dictionary/bdvStatement*.ts; aqui van el nombre, la moneda y el idioma de las cifras.
export const BDV_PROFILE: StatementProfile = {
  id: 'bdv',
  label: 'Banco de Venezuela',
  description: 'Estado de cuenta de BDVenlínea personas, en bolívares.',
  currency: 'VEF',
  numberLocale: 'es',
  amountShape: BDV_AMOUNT_SHAPE,
  referenceShape: BDV_REFERENCE_SHAPE,
  referenceInCell: BDV_REFERENCE_IN_CELL,
  debitWord: BDV_DEBIT_WORD,
  creditWord: BDV_CREDIT_WORD,
  typeWord: BDV_TYPE_WORD,
  typeWordStart: BDV_TYPE_WORD_START,
  typeWordGlobal: BDV_TYPE_WORD_GLOBAL,
  feeReferenceSuffixDigits: BDV_FEE_REFERENCE_SUFFIX_DIGITS,
  kindSignals: BDV_KIND_SIGNALS,
  minDatesWithTitles: BDV_MIN_DATES_WITH_TITLES,
  minRowsWithoutTitles: BDV_MIN_ROWS_WITHOUT_TITLES,
}
