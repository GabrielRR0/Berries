// Formatos de pantalla de lista de movimientos que se conocen. Lo que cambia entre ellos
// es como se distingue el dinero recibido del pagado:
//  - "Movimientos" (BDV, con flechas): los montos recibidos van en verde.
//  - "Historico de operaciones" (inicio de la app de BDV): todos los montos van en blanco
//    y no hay ninguna senal de color, asi que la direccion no se puede deducir de la imagen.
// Si una captura no coincide con ninguno se asume que el color si distingue (lo habitual).
// Texto en minusculas y sin tildes. Para un formato nuevo, agregar una entrada.
export interface BankListFormat {
  id: string
  // Titulo o texto que lo identifica en la captura.
  titlePattern: RegExp
  // true = el verde marca lo recibido; false = el color no dice nada.
  colorCodesDirection: boolean
}

export const BANK_LIST_FORMATS: BankListFormat[] = [
  { id: 'bdv_historico', titlePattern: /historico de operaciones/, colorCodesDirection: false },
  { id: 'bdv_movimientos', titlePattern: /^movimientos$/m, colorCodesDirection: true },
]

export const DEFAULT_COLOR_CODES_DIRECTION = true

// Un monto de la lista debe quedar pegado al borde derecho de la pantalla (donde van los
// montos de los movimientos); asi se descartan numeros sueltos como el saldo de la cabecera
// ("Bs. 3.848,10"), que esta a la izquierda. Fraccion minima del ancho ocupado por el borde derecho.
export const LIST_AMOUNT_MIN_RIGHT_EDGE = 0.8
