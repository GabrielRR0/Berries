// Palabras que indican si entro o salio dinero. Se comparan contra el texto en
// minusculas y SIN tildes ("depósito" se escribe "deposito"). Para ampliar el
// reconocimiento basta con agregar un patron a la lista que corresponda.

// Dinero RECIBIDO. Son pistas fuertes: el texto dice explicitamente que entro dinero.
export const RECEIVED_PATTERNS: RegExp[] = [
  /\babono\b/,
  /\brecibid[oa]s?\b/,
  /\bdeposito\b/,
  /\bcredito\b/,
  /\bacreditad[oa]\b/,
  /\bingreso\b/,
  /\breceived\b/,
  /\bdeposit(ed)?\b/,
  /\bincoming\b/,
  /\bcredit(ed)?\b/,
]

// Dinero PAGADO. Son pistas debiles a proposito: "Operacion pagomovil bdv" aparece
// igual en un pago propio y en uno recibido, asi que estas palabras solo sirven cuando
// no hay otra senal (ni "recibido" ni el color verde del monto).
export const PAID_PATTERNS: RegExp[] = [
  /\boperacion pago ?movil\b/,
  /\bpago\b/,
  /\bcompra\b/,
  /\bretiro\b/,
  /\bdebito\b/,
  /\benviad[oa]\b/,
  /\bpayment\b/,
  /\bpurchase\b/,
  /\bwithdrawal\b/,
  /\bsent\b/,
]
