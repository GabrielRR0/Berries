// Estado de cuenta en tabla. Este archivo solo junta las piezas de la carpeta: el resto del codigo importa
// de aqui y no de los archivos de adentro.
//  - parseBankStatement:           palabras del OCR -> movimientos (parseBankStatement.ts)
//  - statementDescriptionRegion:   donde releer la columna de descripcion (columnLayout.ts)
//  - looksLikeStatement:           si un texto es un estado de cuenta (statementKind.ts)
//  - perfiles de banco:            lo que cambia de un banco a otro (profiles/)
export { parseBankStatement } from './parseBankStatement'
export { statementDescriptionRegion } from './columnLayout'
export { looksLikeStatement } from './statementKind'
export { BANK_OPTIONS, DEFAULT_BANK_ID, getProfile, toBankId } from './profiles'
export type { BankId, BankOption, StatementProfile } from './profiles'
export type { BankStatementOptions } from './types'
