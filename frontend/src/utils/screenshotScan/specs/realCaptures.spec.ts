import { describe, expect, it } from 'vitest'
import { mergeRepeatedRows } from '../mergeRepeatedRows'
import { makeRow } from '../movementRows'
import { rowsFromImage } from '../rowsFromImage'

// Texto que leyo Tesseract de capturas reales de Binance donde algo no salio a la primera.
const TODAY = new Date(2026, 10, 4)
const read = (text: string) =>
  rowsFromImage({ text, words: [], width: 1170, isGreen: () => null }, { today: TODAY, defaultDate: '2026-11-04', scope: 'all' })

// "Detalles del pago" de un envio en el que el OCR no leyo el "-270 USDT" grande del encabezado.
const PAY_SENT_WITHOUT_HEADLINE_OCR = `7:48 ll 53 J

<< Detalles del pago
Importe
(Y) Completado
A eliasjmartinezs1@gmail.com >
PHONECELLVEM

Nota epson
Hora 2026-10-10 15:11:23
Id. de orden 459180715443675136 |)
Método de pago Cuenta de fondos
Pagado con 270 USDT
`

// "Detalles de la orden" de una compra P2P: no muestra fecha, numero de orden ni contraparte.
const P2P_ORDER_DETAIL_OCR = `7:47 al TE
<= Detalles de la orden
+105,18 USDT
(Y) Completado
Comprar USDT ES
Importe en fiat $108
Precio de USDT $1,026
Cantidad recibida 105,18 USDT
Método de pago Zinli USD
Necesito ayuda
Dejar comentarios
Seguir a este usuario []
Realizar orden de nuevo
`

// La misma orden tal como sale en el historial de ordenes.
function listedOrder(orderNumber = '22946216282974314496') {
  return makeRow({
    source: 'p2p_order',
    amount: 108,
    currency: 'USD',
    direction: 'out',
    occurredOn: '2026-10-21',
    time: '09:32',
    description: 'Binance P2P · RaNDoM_LLC',
    reference: orderNumber,
    action: 'transfer',
    sentAmount: 105.18,
    p2p: { usdt: 105.18, price: 1.026, orderNumber, counterparty: 'RaNDoM_LLC' },
  })
}

describe('capturas reales de Binance', () => {
  it('lee un envio de Binance Pay aunque el OCR pierda el monto del encabezado', () => {
    const { kind, rows } = read(PAY_SENT_WITHOUT_HEADLINE_OCR)

    expect(kind).toBe('single')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      amount: 270,
      currency: 'USDT',
      direction: 'out',
      occurredOn: '2026-10-10',
      stamp: '2026-10-10 15:11:23',
      description: 'Binance Pay · PHONECELLVEM · epson',
    })
  })

  it('une el detalle de una orden P2P con su fila del historial (subido despues)', () => {
    const existing = [listedOrder()]
    const added = mergeRepeatedRows(existing, read(P2P_ORDER_DETAIL_OCR).rows)

    expect(added).toHaveLength(0)
    expect(existing[0]).toMatchObject({
      occurredOn: '2026-10-21',
      reference: '22946216282974314496',
      description: 'Binance P2P · RaNDoM_LLC · Zinli',
    })
    expect(existing[0]!.p2p!.paymentMethod).toBe('Zinli')
  })

  it('une el detalle con el historial aunque el detalle se suba primero, y toma la fecha real', () => {
    const existing = read(P2P_ORDER_DETAIL_OCR).rows
    const added = mergeRepeatedRows(existing, [listedOrder()])

    expect(added).toHaveLength(0)
    expect(existing[0]).toMatchObject({ occurredOn: '2026-10-21', time: '09:32', reference: '22946216282974314496' })
    expect(existing[0]!.flags).not.toContain('La captura no muestra la fecha: se usó la elegida al subir.')
  })

  it('no une dos ordenes con numero distinto aunque los montos coincidan', () => {
    const existing = [listedOrder('111')]
    const added = mergeRepeatedRows(existing, [listedOrder('222')])

    expect(added).toHaveLength(1)
  })
})
