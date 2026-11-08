// Estado de cuenta de Banco de Venezuela: que delata que una captura es su tabla (ver
// bankStatement/statementKind.ts). Texto en minusculas y sin tildes.

// Titulos de la tabla: aparecen todos (cada uno es "cualquiera de" sus palabras).
export const BDV_KIND_SIGNALS: RegExp[] = [
  /\bfecha\b/,
  /\b(descripcion|concepto|detalle)\b/,
  /\b(monto|importe|debito|credito|cargo|abono)\b/,
]

// Con los titulos a la vista bastan dos fechas de fila: una captura recortada puede mostrar solo dos filas.
// Un comprobante suelto sigue sin pasar (trae una sola fecha).
export const BDV_MIN_DATES_WITH_TITLES = 2

// Sin los titulos (captura recortada) hacen falta tantas fechas Y tantas palabras de tipo (una por fila).
export const BDV_MIN_ROWS_WITHOUT_TITLES = 3
