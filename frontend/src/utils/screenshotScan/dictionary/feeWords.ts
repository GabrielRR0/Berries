// Palabras que identifican una comision bancaria ("Cobro comision pag movil").
// Texto en minusculas y sin tildes.
export const FEE_PATTERNS: RegExp[] = [/\bcomision\b/, /\bcommission\b/, /\bfee\b/, /\bcargo\b/]

// Categoria con la que se registra una comision que no se pudo unir a su operacion.
export const FEE_CATEGORY = 'Comisión'
