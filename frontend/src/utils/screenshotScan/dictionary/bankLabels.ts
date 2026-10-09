// Etiquetas de los comprobantes de cada banco (al inicio de la linea, en minusculas y
// sin tildes). Para otro banco, agregar su propia entrada y su extractor en
// bankMovementProfiles.ts.
export interface BankLabels {
  date: RegExp
  reference: RegExp
  // Se prueban en orden; vale la primera que tenga valor.
  description: RegExp[]
  // Solo si el comprobante dice si fue debito o credito.
  direction?: RegExp
}

export const BDV_PAGO_MOVIL_LABELS: BankLabels = {
  date: /^fecha\s*:?/,
  reference: /^operacion\s*:?/,
  description: [/^concepto\s*:?/],
}

export const FACEBANK_LABELS: BankLabels = {
  date: /^fecha\s*:?/,
  reference: /^no\.?\s*de referencia\s*:?/,
  description: [/^causa\s*:?/, /^descripcion\s*:?/],
  direction: /^tipo de mov\.?\s*:?/,
}

// Monto grande de la cabecera de un comprobante: "$ 100.00" (el OCR confunde a veces
// el "$" con una "S") y "22.848,00 Bs".
export const HEADLINE_DOLLAR_AMOUNT = /^(?:US)?[$S]\s*(\d[\d.,]*)$/
export const HEADLINE_BOLIVAR_AMOUNT = /^(\d[\d.,]*)\s*(?:bs|ves|vef)\.?$/i

// Valor del "tipo de movimiento" -> si salio o entro dinero.
export const DEBIT_PATTERN = /debito/
export const CREDIT_PATTERN = /credito/
