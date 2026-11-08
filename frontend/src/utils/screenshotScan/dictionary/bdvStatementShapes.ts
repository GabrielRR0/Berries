// Estado de cuenta de Banco de Venezuela: la FORMA de los datos de una fila (ver bankStatement/profiles/bdv.ts).
// Sirve para reconocer cada dato cuando la captura perdio los titulos de las columnas.

// Un monto suelto, con puntos de miles y coma decimal: "-25.000,00", "29.910,06", "876,72".
export const BDV_AMOUNT_SHAPE = /^-?\d[\d.]*,\d{2}$/

// Una referencia completa en una sola palabra: 8 o mas cifras ("0677256690755").
export const BDV_REFERENCE_SHAPE = /^\d{8,}$/

// La referencia dentro del texto de su celda (el OCR a veces la pega con otras cosas).
export const BDV_REFERENCE_IN_CELL = /\d{6,}/

// Cuantas cifras finales de la referencia comparten una comision y su operacion: 0210086173620 (comision)
// y 0677286173620 (operacion) terminan igual porque el banco las genera juntas.
export const BDV_FEE_REFERENCE_SUFFIX_DIGITS = 7
