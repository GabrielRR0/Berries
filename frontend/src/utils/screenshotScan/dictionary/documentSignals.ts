// Como se reconoce que tipo de captura es. Cada tipo suma puntos por cada palabra
// o frase que aparece en el texto (en espanol e ingles); gana el de mayor puntaje
// si llega al minimo. Texto en minusculas y sin tildes.
//
// Para soportar otro banco o documento: agregar una entrada aqui con sus palabras,
// su tipo en DocumentType y su extractor en scanText.ts.
export type DocumentType = 'binance_p2p' | 'bdv_pago_movil' | 'facebank_movement' | 'unknown'

export interface Signal {
  pattern: RegExp
  points: number
}

export interface DocumentSignals {
  type: Exclude<DocumentType, 'unknown'>
  signals: Signal[]
}

// Puntaje minimo para dar por reconocido un documento.
export const MIN_DOCUMENT_SCORE = 4

export const DOCUMENT_SIGNALS: DocumentSignals[] = [
  {
    type: 'binance_p2p',
    signals: [
      { pattern: /\bbinance\b/, points: 3 },
      { pattern: /detalles de la orden|order details/, points: 2 },
      { pattern: /\b(vender|comprar|sell|buy)\s+usdt\b/, points: 2 },
      { pattern: /importe en fiat|fiat amount/, points: 2 },
      { pattern: /apodo del|(buyer|seller)'?s? nick/, points: 2 },
      { pattern: /cantidad total|total quantity/, points: 1 },
      { pattern: /precio de usdt|\bprice\b/, points: 1 },
      { pattern: /de orden|order (no|number|id)/, points: 1 },
    ],
  },
  {
    type: 'bdv_pago_movil',
    signals: [
      { pattern: /comprobante de operacion/, points: 2 },
      { pattern: /pago\s*movil/, points: 2 },
      { pattern: /bdv|banco de venezuela/, points: 3 },
      { pattern: /identificacion\s*:/, points: 1 },
      { pattern: /\borigen\s*:/, points: 1 },
      { pattern: /\bdestino\s*:/, points: 1 },
      { pattern: /\bconcepto\s*:/, points: 1 },
    ],
  },
  {
    type: 'facebank_movement',
    signals: [
      { pattern: /facebank/, points: 3 },
      { pattern: /detalle de movimiento/, points: 3 },
      { pattern: /tipo de mov/, points: 2 },
      { pattern: /codigo de causa/, points: 2 },
      { pattern: /no\.?\s*de referencia/, points: 1 },
      { pattern: /\bcausa\b/, points: 1 },
    ],
  },
]
