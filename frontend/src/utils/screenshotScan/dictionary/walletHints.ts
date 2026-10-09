// Bancos y plataformas conocidos. Cada uno tiene:
//  - `nameHints`: palabras con las que el usuario suele nombrar su billetera (sirven
//    para elegir la billetera correcta cuando hay varias de la misma moneda).
//  - `textPattern`: como se reconoce el banco en el texto de una captura.
// Para soportar otro banco se agrega una entrada aqui (y su clave al tipo WalletKey).
export type WalletKey = 'bdv' | 'facebank' | 'banesco' | 'mercantil' | 'provincial' | 'binance'

export interface WalletHint {
  nameHints: string[]
  textPattern: RegExp
}

export const WALLET_HINTS: Record<WalletKey, WalletHint> = {
  bdv: { nameHints: ['bdv', 'venezuela'], textPattern: /\bbdv\b|pagomovil ?bdv|banco de venezuela/ },
  facebank: { nameHints: ['facebank'], textPattern: /facebank/ },
  banesco: { nameHints: ['banesco'], textPattern: /banesco/ },
  mercantil: { nameHints: ['mercantil'], textPattern: /mercantil/ },
  provincial: { nameHints: ['provincial', 'bbva'], textPattern: /provincial|bbva/ },
  binance: { nameHints: ['binance', 'usdt'], textPattern: /binance/ },
}
