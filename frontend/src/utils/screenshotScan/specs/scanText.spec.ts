import { describe, expect, it } from 'vitest'
import { classifyDocument } from '../classifyDocument'
import { parseDateToIso, parseLocalizedNumber } from '../numbers'
import { scanText } from '../scanText'
import type { P2PTransferScan } from '../types'

// Texto tal como lo devuelve el OCR en las dos capturas reales de Binance P2P.
const BINANCE_SIN_DETALLE = `Detalles de la orden
-26,48 USDT
Completado
Vender USDT
Chat
Importe en fiat Bs26.600
Precio de USDT Bs1.006,513
Cantidad total 26,48 USDT
Método de pago Pago Movil VES
Necesito ayuda
Dejar comentarios
Seguir a este usuario
Realizar orden de nuevo`

const BINANCE_CON_DETALLE = `Detalles de la orden
-26,48 USDT
Completado
Vender USDT
Chat
Importe en fiat Bs26.600
Precio de USDT Bs1.006,513
Cantidad total 26,48 USDT
Cantidad liberada 26,42 USDT
Comisión 0,06 USDT
Método de pago Pago Movil VES
N.º de orden 22941692196588679168
Hora de creación 2026-10-08 21:55:19
Apodo del
comprador Nelasurej ©
Necesito ayuda`

const BINANCE_INGLES = `Order Details
Sell USDT
Fiat amount Bs26,600
Price Bs1,006.513
Total quantity 26.48 USDT
Released quantity 26.42 USDT
Fee 0.06 USDT
Order No. 22941692196588679168
Creation time 2026-10-08 21:55:19
Buyer's nickname Nelasurej
Completed`

function scanBinance(text: string): P2PTransferScan {
  const result = scanText(text)
  if (result.kind !== 'p2p_transfer') throw new Error(`se esperaba p2p_transfer, llego ${result.kind}`)
  return result
}

describe('parseLocalizedNumber', () => {
  it('espanol: punto de miles y coma decimal', () => {
    expect(parseLocalizedNumber('1.006,513', 'es')).toBe(1006.513)
    expect(parseLocalizedNumber('26.600', 'es')).toBe(26600)
    expect(parseLocalizedNumber('26,48', 'es')).toBe(26.48)
  })

  it('ingles: coma de miles y punto decimal', () => {
    expect(parseLocalizedNumber('1,006.513', 'en')).toBe(1006.513)
    expect(parseLocalizedNumber('26,600', 'en')).toBe(26600)
    expect(parseLocalizedNumber('26.48', 'en')).toBe(26.48)
  })

  it('devuelve null si no hay digitos', () => {
    expect(parseLocalizedNumber('Bs', 'es')).toBeNull()
  })
})

describe('parseDateToIso', () => {
  it('lee ISO, dia/mes (es) y mes/dia (en)', () => {
    expect(parseDateToIso('2026-10-08 21:55:19', 'es')).toBe('2026-10-08')
    expect(parseDateToIso('08/10/2026 21:55', 'es')).toBe('2026-10-08')
    expect(parseDateToIso('10/08/2026 9:55 PM', 'en')).toBe('2026-10-08')
  })

  it('descarta fechas imposibles', () => {
    expect(parseDateToIso('31/02/2026', 'es')).toBeNull()
  })
})

describe('classifyDocument', () => {
  it('reconoce Binance P2P en espanol y en ingles', () => {
    expect(classifyDocument(BINANCE_SIN_DETALLE)).toBe('binance_p2p')
    expect(classifyDocument(BINANCE_INGLES)).toBe('binance_p2p')
  })

  it('un texto cualquiera queda como desconocido', () => {
    expect(classifyDocument('Factura 0001 Total a pagar 15,00 Gracias por su compra')).toBe('unknown')
  })
})

describe('scanText - Binance P2P', () => {
  it('captura sin detalle: lee montos y deja fecha y orden vacios', () => {
    const scan = scanBinance(BINANCE_SIN_DETALLE)

    expect(scan.direction).toBe('sell')
    expect(scan.amount).toBe(26.48)
    expect(scan.fee).toBeNull()
    expect(scan.convertedAmount).toBe(26600)
    expect(scan.fiatCurrency).toBe('VEF')
    expect(scan.unitPrice).toBe(1006.513)
    expect(scan.occurredOn).toBeNull()
    expect(scan.orderNumber).toBeNull()
    expect(scan.completed).toBe(true)
  })

  it('captura con detalle: el monto es lo liberado y la comision va aparte', () => {
    const scan = scanBinance(BINANCE_CON_DETALLE)

    expect(scan.amount).toBe(26.42)
    expect(scan.fee).toBe(0.06)
    expect(scan.convertedAmount).toBe(26600)
    expect(scan.occurredOn).toBe('2026-10-08')
    expect(scan.orderNumber).toBe('22941692196588679168')
    expect(scan.counterparty).toBe('Nelasurej')
  })

  it('captura en ingles', () => {
    const scan = scanBinance(BINANCE_INGLES)

    expect(scan.direction).toBe('sell')
    expect(scan.amount).toBe(26.42)
    expect(scan.fee).toBe(0.06)
    expect(scan.convertedAmount).toBe(26600)
    expect(scan.unitPrice).toBe(1006.513)
    expect(scan.occurredOn).toBe('2026-10-08')
    expect(scan.counterparty).toBe('Nelasurej')
  })

  it('con total y comision pero sin cantidad liberada, resta la comision', () => {
    const scan = scanBinance(BINANCE_CON_DETALLE.replace(/Cantidad liberada.*\n/, ''))

    expect(scan.amount).toBe(26.42)
  })

  it('avisa cuando los montos no cuadran', () => {
    const scan = scanBinance(BINANCE_SIN_DETALLE.replace('Bs26.600', 'Bs9.600'))

    expect(scan.warnings.join(' ')).toContain('no coincide')
  })

  it('detecta una compra', () => {
    expect(scanBinance(BINANCE_SIN_DETALLE.replace('Vender USDT', 'Comprar USDT')).direction).toBe('buy')
  })
})
