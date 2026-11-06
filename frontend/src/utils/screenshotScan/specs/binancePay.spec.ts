import { describe, expect, it } from 'vitest'
import { classifyDocument } from '../classifyDocument'
import { mergeRepeatedRows } from '../mergeRepeatedRows'
import { applyRowDefaults } from '../rowDefaults'
import { rowFingerprint } from '../rowFingerprint'
import { rowsFromImage } from '../rowsFromImage'

// Texto que leyo Tesseract de las capturas reales de Binance Pay (envios y recibos de USDT, no P2P).
const PAY_LIST_OCR = `< Activos y
General
Pay y [ma]
Pay -40 USDT
Enviar criptos User-aoBbe
2026-10-31 19:48:46
Pay +150 USDT
Recibir criptos Stevensgold
2026-10-31 14:19:52
Pay +153 USDT
Recibir criptos User-2d328
2026-10-11 11:56:10
Pay -270 USDT
Enviar criptos PHONECELLVEM
2026-10-10 15:11:23
Pay +100 USDT
Recibir criptos Stevensgold
2026-09-29 20:00:09
Pay +90 USDT
Recibir criptos Stevensgold
2026-09-21 15:24:51
Pay -20 USDT
`

const PAY_RECEIVED_OCR = `7:48 7

€ Detalles del pago

Importe
+153 USDT
(© Completado
Se han enviado criptomonedas a tu cuenta

De User-24328
Nota -—
Hora 2026-10-11 11:56:10
1d. de orden 459341104805896193 [3]`

const PAY_SENT_OCR = `7:48 Te

€ Detalles del pago

Importe
-270 USDT
(9 Completado
A eliasjmartinezs1@gmail.com |
PHONECELLVEM

Nota epson
Hora 2026-10-10 15:11:23
Id. de orden 459180715443675136 [3]
Método de pago Cuenta de fondos
Pagado con 270 USDT`

const TODAY = new Date(2026, 10, 5)
const read = (text: string, scope: 'all' | 'expenses' | 'received' = 'all') =>
  rowsFromImage({ text, words: [], width: 486, isGreen: () => null }, { today: TODAY, defaultDate: '2026-11-04', scope })

const WALLETS = [
  { id: 'binance', name: 'Binance', currency: 'USDT', balance: 0, createdAt: '' },
  { id: 'bdv', name: 'BDV', currency: 'VEF', balance: 0, createdAt: '' },
]

describe('lista "Activos > Pay" de Binance', () => {
  it('se reconoce y lee cada envio (gasto) y recibo (ingreso) en USDT', () => {
    const { kind, rows } = read(PAY_LIST_OCR)

    expect(kind).toBe('binance_pay')
    // El ultimo (-20 USDT) quedo cortado sin su fecha: se descarta.
    expect(rows.map((row) => [row.direction, row.amount, row.occurredOn, row.time])).toEqual([
      ['out', 40, '2026-10-31', '19:48'],
      ['in', 150, '2026-10-31', '14:19'],
      ['in', 153, '2026-10-11', '11:56'],
      ['out', 270, '2026-10-10', '15:11'],
      ['in', 100, '2026-09-29', '20:00'],
      ['in', 90, '2026-09-21', '15:24'],
    ])
    expect(rows[0]).toMatchObject({
      source: 'bank',
      currency: 'USDT',
      action: 'expense',
      description: 'Binance Pay · User-aoBbe',
      stamp: '2026-10-31 19:48:46',
    })
    expect(rows[1]).toMatchObject({ action: 'income', description: 'Binance Pay · Stevensgold' })
  })

  it('"solo gastos" deja solo los envios', () => {
    expect(read(PAY_LIST_OCR, 'expenses').rows.map((row) => row.amount)).toEqual([40, 270])
  })

  it('se registran en la billetera USDT', () => {
    const rows = applyRowDefaults(read(PAY_LIST_OCR).rows, { wallets: WALLETS, selectedWalletId: '' })
    expect(rows.every((row) => row.walletId === 'binance')).toBe(true)
  })

  it('si el OCR pierde el signo, el tipo ("Enviar criptos") dice que salio', () => {
    const { rows } = read(PAY_LIST_OCR.replace('Pay -40 USDT', 'Pay 40 USDT'))
    expect(rows[0]).toMatchObject({ direction: 'out', amount: 40 })
  })
})

describe('"Detalles del pago" de Binance Pay', () => {
  it('un recibo: ingreso en USDT con contraparte, hora e id de orden', () => {
    expect(classifyDocument(PAY_RECEIVED_OCR)).toBe('binance_pay')
    const { kind, rows } = read(PAY_RECEIVED_OCR)

    expect(kind).toBe('single')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source: 'bank',
      amount: 153,
      currency: 'USDT',
      direction: 'in',
      action: 'income',
      occurredOn: '2026-10-11',
      time: '11:56',
      stamp: '2026-10-11 11:56:10',
      reference: '459341104805896193',
      description: 'Binance Pay · User-24328',
      flags: [],
    })
  })

  it('un envio: gasto con el apodo (no el correo) y la nota', () => {
    const [row] = read(PAY_SENT_OCR).rows

    expect(row).toMatchObject({
      amount: 270,
      direction: 'out',
      action: 'expense',
      occurredOn: '2026-10-10',
      reference: '459180715443675136',
      description: 'Binance Pay · PHONECELLVEM · epson',
    })
    expect(row!.description).not.toContain('@')
  })
})

describe('el mismo pago en la lista y en su detalle', () => {
  it('no se repite: el detalle completa la fila de la lista', () => {
    const list = read(PAY_LIST_OCR).rows
    const detail = read(PAY_SENT_OCR).rows

    expect(mergeRepeatedRows(list, detail)).toEqual([])
    const merged = list.find((row) => row.amount === 270)!
    expect(merged.reference).toBe('459180715443675136')
    expect(merged.description).toBe('Binance Pay · PHONECELLVEM · epson')
  })

  it('tiene la misma huella aunque el OCR lea distinto el apodo, asi se detecta si ya se registro', () => {
    const fromList = read(PAY_LIST_OCR).rows.find((row) => row.amount === 153)!
    const fromDetail = read(PAY_RECEIVED_OCR).rows[0]!

    expect(fromList.description).not.toBe(fromDetail.description)
    expect(rowFingerprint(fromList)).toBe(rowFingerprint(fromDetail))
  })
})
