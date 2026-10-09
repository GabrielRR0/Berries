import { classifyDocument } from './classifyDocument'
import { extractBinanceP2p } from './binanceP2pProfile'
import { extractBdvPagoMovil, extractFacebankMovement } from './bankMovementProfiles'
import type { ScanResult } from './types'

// Texto OCR -> campos estructurados. Primero se decide que tipo de captura es y
// despues se usa el extractor de ese tipo.
export function scanText(text: string): ScanResult {
  switch (classifyDocument(text)) {
    case 'binance_p2p':
      return extractBinanceP2p(text)
    case 'bdv_pago_movil':
      return extractBdvPagoMovil(text)
    case 'facebank_movement':
      return extractFacebankMovement(text)
    default:
      return { kind: 'unknown' }
  }
}
