// Resultado de leer el texto de una captura. Todo campo que no se pudo leer
// queda en null: la pantalla de revision lo deja vacio para que el usuario lo
// complete en vez de inventar un valor.
export type NumberLocale = 'es' | 'en'

export interface P2PTransferScan {
  kind: 'p2p_transfer'
  // Binance P2P: "Vender USDT" / "Comprar USDT"
  direction: 'sell' | 'buy' | null
  // USDT que salen de la billetera sin contar la comision (la "cantidad liberada").
  amount: number | null
  fee: number | null
  // Importe en moneda local que llega a la otra billetera.
  convertedAmount: number | null
  // Codigo de la moneda local usado por Berry (Bs -> VEF); null si no se reconoce.
  fiatCurrency: string | null
  unitPrice: number | null
  // YYYY-MM-DD en hora local, el mismo formato del <input type="date">.
  occurredOn: string | null
  orderNumber: string | null
  counterparty: string | null
  completed: boolean | null
  warnings: string[]
}

// Comprobante o detalle de un movimiento bancario (Pago Movil BDV, Facebank).
// A diferencia de la orden P2P no trae las dos patas: solo el dinero que sale
// (o entra) de una cuenta, que el usuario registra como gasto/ingreso o como
// transferencia hacia otra de sus billeteras.
export type BankName = 'bdv' | 'facebank'

export interface BankMovementScan {
  kind: 'bank_movement'
  bank: BankName
  direction: 'debit' | 'credit' | null
  amount: number | null
  // Codigo de la moneda usado por Berry ($ -> USD, Bs -> VEF); null si no se reconoce.
  currency: string | null
  occurredOn: string | null
  reference: string | null
  // Concepto / causa tal como lo muestra el banco.
  description: string | null
  warnings: string[]
}

export interface UnknownScan {
  kind: 'unknown'
}

export type ScanResult = P2PTransferScan | BankMovementScan | UnknownScan
