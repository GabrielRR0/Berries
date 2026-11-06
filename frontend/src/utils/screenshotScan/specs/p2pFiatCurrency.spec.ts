import { describe, expect, it } from 'vitest'
import { fiatCurrencyOf } from '../fiatCurrency'
import { matchP2pOrders } from '../matchP2pOrders'
import { makeRow } from '../movementRows'
import { groupSegments } from '../ocrLayout'
import type { OcrWord } from '../ocrLayout'
import { parseP2pOrderList } from '../p2pOrderListParser'
import { applyRowDefaults } from '../rowDefaults'
import { classifyImageKind, rowsFromImage, rowsFromSingleScan } from '../rowsFromImage'
import { scanText } from '../scanText'
import { line } from './listFixtures'

// Historial de ordenes real (430 px de ancho): una compra de USDT con dolares (ej. de Zinli o
// Wally) y dos ventas por bolivares.
const TODAY = new Date(2026, 10, 5)
const MIXED_WORDS: OcrWord[] = [
  ...line('Historial de órdenes', 120, 310, 12, 32),
  ...line('Comprar USDT', 12, 120, 157, 177),
  ...line('Completado', 325, 400, 158, 175),
  ...line('Importe', 12, 64, 199, 216),
  ...line('$30', 370, 402, 198, 218),
  ...line('Precio', 12, 56, 227, 244),
  ...line('$1,011', 352, 402, 227, 244),
  ...line('Cantidad recibida', 12, 130, 254, 271),
  ...line('29,59 USDT', 320, 402, 254, 271),
  ...line('Orden', 12, 50, 281, 298),
  ...line('22948458253842694144', 208, 385, 281, 298),
  ...line('superapide 1', 22, 112, 312, 330),
  ...line('10-27 14:01:13', 310, 402, 313, 329),
  ...line('Vender USDT', 12, 120, 372, 392),
  ...line('Completado', 325, 400, 373, 390),
  ...line('Importe', 12, 64, 405, 422),
  ...line('Bs6.800', 340, 402, 404, 424),
  ...line('Precio', 12, 56, 433, 450),
  ...line('Bs989,725', 330, 402, 433, 450),
  ...line('Cantidad total', 12, 120, 460, 477),
  ...line('6,93 USDT', 325, 402, 460, 477),
  ...line('Orden', 12, 50, 487, 504),
  ...line('22947449608892088320', 208, 385, 487, 504),
  ...line('GlobalTrade_ 3', 22, 122, 520, 538),
  ...line('10-24 19:13:13', 310, 402, 521, 537),
  ...line('Vender USDT', 12, 120, 597, 617),
  ...line('Completado', 325, 400, 598, 615),
  ...line('Importe', 12, 64, 610, 627),
  ...line('Bs10.000', 330, 402, 609, 629),
  ...line('Precio', 12, 56, 638, 655),
  ...line('Bs994,147', 330, 402, 638, 655),
  ...line('Cantidad total', 12, 120, 665, 682),
  ...line('10,11 USDT', 320, 402, 665, 682),
  ...line('Orden', 12, 50, 692, 709),
  ...line('22947377101448122368', 208, 385, 692, 709),
  ...line('AUTOPAY-P2P 10', 22, 122, 726, 744),
  ...line('10-24 14:25:06', 310, 402, 727, 743),
]

const TEXT = MIXED_WORDS.map((word) => word.text).join(' ')

describe('moneda del importe de una orden P2P', () => {
  it('reconoce Bs, $ y codigos explicitos', () => {
    expect(fiatCurrencyOf(['Bs6.800'], 989.7)).toBe('VEF')
    expect(fiatCurrencyOf(['$30'], 1.011)).toBe('USD')
    expect(fiatCurrencyOf(['COP 50.000'], 3900)).toBe('COP')
  })

  it('un "$" con precio alto es un peso: no adivina cual', () => {
    expect(fiatCurrencyOf(['$50.000'], 3900)).toBeNull()
  })

  it('sin simbolo legible (OCR leyo "S30"), un precio cercano a 1 es dolar', () => {
    expect(fiatCurrencyOf(['S30', 'S1,011'], 1.011)).toBe('USD')
    expect(fiatCurrencyOf(['30'], 990)).toBeNull()
  })
})

describe('historial de ordenes con compra en dolares', () => {
  const rows = () => parseP2pOrderList(groupSegments(MIXED_WORDS, 430), TODAY)

  it('se reconoce como historial de ordenes', () => {
    expect(classifyImageKind(TEXT)).toBe('p2p_orders')
  })

  it('la compra sale en USD y llegan los USDT recibidos', () => {
    const [buy] = rows()

    expect(buy).toMatchObject({
      source: 'p2p_order',
      amount: 30,
      currency: 'USD',
      direction: 'out',
      occurredOn: '2026-10-27',
      time: '14:01',
      action: 'transfer',
      sentAmount: 29.59,
      reference: '22948458253842694144',
      flags: [],
    })
    expect(buy!.p2p).toEqual({ usdt: 29.59, price: 1.011, orderNumber: '22948458253842694144', counterparty: 'superapide' })
  })

  it('las ventas siguen en bolivares', () => {
    const [, first, second] = rows()

    expect(first).toMatchObject({ amount: 6800, currency: 'VEF', direction: 'in', sentAmount: 6.93 })
    expect(second).toMatchObject({ amount: 10000, currency: 'VEF', direction: 'in', sentAmount: 10.11 })
  })

  it('avisa si el importe no cuadra con USDT x precio (OCR leyo "$30" como "530")', () => {
    const misread = MIXED_WORDS.map((word) => (word.text === '$30' ? { ...word, text: '530' } : word))
    const [buy] = parseP2pOrderList(groupSegments(misread, 430), TODAY)

    expect(buy!.flags.join(' ')).toContain('no coincide')
  })

  it('propone la transferencia desde la billetera en dolares hacia la de USDT', () => {
    const wallets = [
      { id: 'zinli', name: 'Zinli', currency: 'USD', balance: 100, createdAt: '' },
      { id: 'bdv', name: 'BDV', currency: 'VEF', balance: 0, createdAt: '' },
      { id: 'binance', name: 'Binance', currency: 'USDT', balance: 0, createdAt: '' },
    ]
    const [buy, sell] = applyRowDefaults(rows(), { wallets, selectedWalletId: '' })

    expect(buy).toMatchObject({ fromWalletId: 'zinli', toWalletId: 'binance' })
    expect(sell).toMatchObject({ fromWalletId: 'binance', toWalletId: 'bdv' })
  })

  it('con varias billeteras en dolares usa la elegida en el primer paso', () => {
    const wallets = [
      { id: 'zinli', name: 'Zinli', currency: 'USD', balance: 100, createdAt: '' },
      { id: 'wally', name: 'Wally', currency: 'USD', balance: 100, createdAt: '' },
      { id: 'binance', name: 'Binance', currency: 'USDT', balance: 0, createdAt: '' },
    ]
    expect(applyRowDefaults(rows(), { wallets, selectedWalletId: '' })[0]!.fromWalletId).toBe('')
    expect(applyRowDefaults(rows(), { wallets, selectedWalletId: 'wally' })[0]!.fromWalletId).toBe('wally')
  })

  it('no enlaza una orden en dolares con un movimiento del banco en Bs del mismo importe', () => {
    const [buy] = rows()
    const bank = makeRow({ source: 'bank', amount: 30, currency: 'VEF', direction: 'out', occurredOn: '2026-10-27', time: '14:00' })
    matchP2pOrders([bank, buy!])

    expect(bank.linkedOrderNumber).toBeNull()
  })
})

describe('detalle de una compra P2P', () => {
  const BUY_DETAIL = `Detalles de la orden
Comprar USDT
Completado
Importe en fiat $30
Precio $1,011
Cantidad recibida 29,59 USDT
Hora de creación 2026-10-27 14:01:13
N.º de orden 22948458253842694144`

  it('se registra como transferencia de dolares a USDT (antes se descartaba)', () => {
    const [row] = rowsFromSingleScan(scanText(BUY_DETAIL))

    expect(row).toMatchObject({
      source: 'p2p_order',
      amount: 30,
      currency: 'USD',
      direction: 'out',
      occurredOn: '2026-10-27',
      action: 'transfer',
      sentAmount: 29.59,
      fee: 0,
    })
  })
})

// Texto que leyo Tesseract de la captura real de "Detalles de la orden" de una compra pagada
// con Zinli: no muestra fecha ni numero de orden (quedan en la parte plegada).
const BUY_DETAIL_ZINLI_OCR = `7:46 . TE
« Detalles de la orden
+29,59 USDT
© Completado
Comprar USDT ES
Importe en fiat $30
Precio de USDT $1,011
Cantidad recibida 29,59 USDT
Método de pago + Zinli uso
Necesito ayuda >
Dejar comentarios >
Seguir a este usuario .
Realizar orden de nuevo`

describe('detalle de una compra P2P pagada con Zinli (captura real)', () => {
  const read = (defaultDate: string | null) =>
    rowsFromImage(
      { text: BUY_DETAIL_ZINLI_OCR, words: [], width: 457, isGreen: () => null },
      { today: TODAY, defaultDate },
    )

  it('se lee como una transferencia de 30 USD a 29,59 USDT', () => {
    const { kind, rows } = read('2026-11-05')

    expect(kind).toBe('single')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      amount: 30,
      currency: 'USD',
      direction: 'out',
      action: 'transfer',
      sentAmount: 29.59,
      description: 'Binance P2P · Zinli',
    })
    expect(rows[0]!.p2p).toMatchObject({ usdt: 29.59, price: 1.011, paymentMethod: 'Zinli' })
  })

  it('sin fecha en la captura usa la elegida al subir y lo avisa', () => {
    const [row] = read('2026-11-05').rows

    expect(row!.occurredOn).toBe('2026-11-05')
    expect(row!.flags).toEqual(['La captura no muestra la fecha: se usó la elegida al subir.'])
    expect(read(null).rows[0]!.flags).toEqual(['Falta la fecha.'])
  })

  it('el metodo de pago elige la billetera Zinli entre varias en dolares', () => {
    const wallets = [
      { id: 'zinli', name: 'Zinli', currency: 'USD', balance: 100, createdAt: '' },
      { id: 'wally', name: 'Wally', currency: 'USD', balance: 100, createdAt: '' },
      { id: 'binance', name: 'Binance', currency: 'USDT', balance: 0, createdAt: '' },
    ]
    const [row] = applyRowDefaults(read('2026-11-05').rows, { wallets, selectedWalletId: '' })

    expect(row).toMatchObject({ fromWalletId: 'zinli', toWalletId: 'binance' })
  })
})
