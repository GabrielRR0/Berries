// Estado de cuenta de Banco de Venezuela: las palabras de la columna "Debito / Credito" (ver
// bankStatement/profiles/bdv.ts). Texto en minusculas y sin tildes.

// La palabra de tipo que significa que salio dinero.
export const BDV_DEBIT_WORD = /debito|cargo|retiro/

// La palabra de tipo que significa que entro dinero.
export const BDV_CREDIT_WORD = /credito|abono|deposito/

// La palabra de tipo completa y sola, para deducir columnas cuando faltan los titulos.
export const BDV_TYPE_WORD = /^(debito|credito)$/

// Inicio de la palabra de tipo, tolerante a una letra mal leida: ubica cada fila (hay una por movimiento).
export const BDV_TYPE_WORD_START = /^(deb|cred|cargo|abono)/

// La palabra de tipo dentro de todo el texto (con /g): cuenta cuantas filas trae la captura.
export const BDV_TYPE_WORD_GLOBAL = /\b(debito|credito)\b/g
