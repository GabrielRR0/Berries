import { STATEMENT_DATE_GLOBAL } from '../dictionary/bankStatementLabels'
import type { StatementProfile } from './profiles/types'

// Decide si el texto de una captura es un estado de cuenta en tabla. Recibe el texto ya normalizado
// (minusculas y sin tildes) y el perfil del banco; devuelve true o false.
// Se reconoce por sus filas, que traen varias fechas completas (un comprobante suelto trae una sola):
//  - con los titulos a la vista (Fecha, Descripcion, Monto...) bastan pocas fechas: una captura recortada
//    puede mostrar solo dos filas;
//  - sin los titulos (recortada) hacen falta mas fechas Y la palabra de tipo (Debito / Credito) de cada fila.
export function looksLikeStatement(normalizedText: string, profile: StatementProfile): boolean {
  const dates = (normalizedText.match(STATEMENT_DATE_GLOBAL) ?? []).length
  const hasTitles = profile.kindSignals.every((signal) => signal.test(normalizedText))
  const typeWords = (normalizedText.match(profile.typeWordGlobal) ?? []).length
  const withTitles = hasTitles && dates >= profile.minDatesWithTitles
  const withoutTitles = dates >= profile.minRowsWithoutTitles && typeWords >= profile.minRowsWithoutTitles
  return withTitles || withoutTitles
}
