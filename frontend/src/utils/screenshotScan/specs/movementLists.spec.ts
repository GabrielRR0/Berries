import { describe, expect, it } from 'vitest'
import { parseBankList } from '../bankListParser'
import { matchP2pOrders } from '../matchP2pOrders'
import { isFeeText, matchesReceived, resolveDateHeader, suggestCategory } from '../movementDictionary'
import { to24h } from '../movementRows'
import { groupSegments } from '../ocrLayout'
import { parseP2pOrderList } from '../p2pOrderListParser'
import { BANK_WORDS, P2P_WORDS, TODAY, isGreen } from './listFixtures'

function bankRows() {
  const segments = groupSegments(BANK_WORDS, 924)
  return parseBankList(segments, { today: TODAY, defaultDate: null, isGreen })
}

describe('diccionario', () => {
  it('reconoce dinero recibido en espanol e ingles', () => {
    expect(matchesReceived('Abono recibido otr bcos')).toBe(true)
    expect(matchesReceived('Deposit received')).toBe(true)
    expect(matchesReceived('Operacion pagomovil bdv')).toBe(false)
  })

  it('reconoce comisiones y sugiere su categoria', () => {
    expect(isFeeText('Cobro comision pag movil bdv a bdv')).toBe(true)
    expect(suggestCategory('Cobro comisión pag movil')).toBe('Comisión')
    expect(suggestCategory('Pago de gasolina')).toBe('Gasolina')
  })

  it('resuelve ayer, hoy y fechas escritas', () => {
    expect(resolveDateHeader('AYER', TODAY)).toBe('2026-10-08')
    expect(resolveDateHeader('Hoy', TODAY)).toBe('2026-10-09')
    expect(resolveDateHeader('Yesterday', TODAY)).toBe('2026-10-08')
    expect(resolveDateHeader('08/10/2026', TODAY)).toBe('2026-10-08')
    expect(resolveDateHeader('8 de octubre', TODAY)).toBe('2026-10-08')
    expect(resolveDateHeader('Movimientos', TODAY)).toBeNull()
  })

  it('convierte horas de 12 a 24 horas', () => {
    expect(to24h('10:25 PM')).toBe('22:25')
    expect(to24h('12:05 AM')).toBe('00:05')
    expect(to24h('21:55:19')).toBe('21:55')
    expect(to24h('hola')).toBeNull()
  })
})

describe('lista de movimientos del banco', () => {
  it('lee las filas con fecha de "AYER", hora y descripcion', () => {
    const rows = bankRows()

    expect(rows.map((row) => row.amount)).toEqual([22848, 26600, 9000, 10000, 10500])
    expect(rows.every((row) => row.occurredOn === '2026-10-08')).toBe(true)
    expect(rows.map((row) => row.time)).toEqual(['22:25', '21:58', '19:57', '19:51', '19:49'])
    expect(rows[1]!.description).toBe('Abono recibido otr bcos')
    expect(rows[0]!.description).toBe('Operacion pagomovil bdv')
  })

  it('une cada comision con la operacion de la misma hora', () => {
    const rows = bankRows()

    expect(rows.map((row) => row.fee)).toEqual([68.54, 0, 27, 0, 31.5])
    expect(rows.some((row) => /comision/i.test(row.description))).toBe(false)
  })

  it('el verde o la palabra "recibido" marcan dinero recibido; lo demas es gasto', () => {
    const rows = bankRows()

    expect(rows.map((row) => row.direction)).toEqual(['out', 'in', 'out', 'in', 'out'])
    expect(rows.map((row) => row.action)).toEqual(['expense', 'income', 'expense', 'income', 'expense'])
  })

  it('usa la fecha por defecto cuando no hay encabezado de dia', () => {
    const noHeader = BANK_WORDS.filter((word) => word.text !== 'AYER')
    const rows = parseBankList(groupSegments(noHeader, 924), {
      today: TODAY,
      defaultDate: '2026-10-07',
      isGreen,
    })

    expect(rows.every((row) => row.occurredOn === '2026-10-07')).toBe(true)
  })

  it('marca para revisar la fecha faltante y el color no medido', () => {
    const noHeader = BANK_WORDS.filter((word) => word.text !== 'AYER')
    const rows = parseBankList(groupSegments(noHeader, 924), { today: TODAY, defaultDate: null, isGreen: () => null })

    expect(rows[0]!.flags).toContain('Falta la fecha.')
    expect(rows[0]!.flags.join(' ')).toContain('gasto o dinero recibido')
    // "Abono recibido" no necesita el color para saber que es recibido.
    expect(rows[1]!.direction).toBe('in')
  })

  it('una comision sin operacion de la misma hora queda como gasto "Comisión"', () => {
    const onlyFee = BANK_WORDS.filter((word) => word.y0 < 700 || word.y0 === 513)
    const rows = parseBankList(groupSegments(onlyFee, 924), { today: TODAY, defaultDate: null, isGreen })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount: 68.54, category: 'Comisión', action: 'expense' })
  })
})

describe('historial de ordenes P2P de Binance', () => {
  const rows = () => parseP2pOrderList(groupSegments(P2P_WORDS, 1170), TODAY)

  it('lee importe, USDT, precio, orden, contraparte y fecha de cada venta', () => {
    const [first, second] = rows()

    expect(first).toMatchObject({
      source: 'p2p_order',
      amount: 26600,
      direction: 'in',
      occurredOn: '2026-10-08',
      time: '21:55',
      reference: '22941692196588679168',
    })
    expect(first!.p2p).toEqual({
      usdt: 26.48,
      price: 1006.513,
      orderNumber: '22941692196588679168',
      counterparty: 'Nelasurej',
    })
    expect(second!.p2p).toMatchObject({ usdt: 10.15, price: 991.001, counterparty: 'OikonomiaDigital' })
    expect(second!.time).toBe('19:51')
  })

  it('ignora las ordenes canceladas', () => {
    const words = P2P_WORDS.map((word) => (word.text === 'Completado' && word.y0 === 733 ? { ...word, text: 'Cancelado' } : word))

    expect(parseP2pOrderList(groupSegments(words, 1170), TODAY)).toHaveLength(2)
  })

  it('cada orden se propone como transferencia, con los USDT ya conocidos', () => {
    const parsed = rows()

    expect(parsed.every((row) => row.action === 'transfer')).toBe(true)
    expect(parsed.map((row) => row.sentAmount)).toEqual([26.48, 10.15, 10.15])
  })

  it('quita el ruido del OCR junto al apodo (icono de chat e insignia de mensajes)', () => {
    const noisy = P2P_WORDS.map((word) =>
      word.text === '5' ? { ...word, text: 'O' } : word,
    )
    const [first, second] = parseP2pOrderList(groupSegments(noisy, 1170), TODAY)

    expect(first!.p2p!.counterparty).toBe('Nelasurej')
    expect(first!.description).toBe('Binance P2P · Nelasurej')
    expect(second!.p2p!.counterparty).toBe('OikonomiaDigital')
  })

  it('el ano es el actual, o el anterior si la fecha caeria en el futuro', () => {
    const january = new Date(2027, 0, 5)
    const parsed = parseP2pOrderList(groupSegments(P2P_WORDS, 1170), january)

    expect(parsed[0]!.occurredOn).toBe('2026-10-08')
  })
})

describe('enlace de recibidos con ordenes P2P', () => {
  it('completa el recibido con los USDT de la orden del mismo importe y hora cercana', () => {
    const bank = bankRows()
    const orders = parseP2pOrderList(groupSegments(P2P_WORDS, 1170), TODAY)

    matchP2pOrders([...bank, ...orders])

    const received26600 = bank.find((row) => row.amount === 26600)!
    expect(received26600).toMatchObject({ action: 'transfer', sentAmount: 26.48, linkedOrderNumber: '22941692196588679168' })
    expect(received26600.flags.join(' ')).toContain('26.48 USDT')

    const received10000 = bank.find((row) => row.amount === 10000)!
    expect(received10000).toMatchObject({ action: 'transfer', sentAmount: 10.15 })
    // Entre las dos ordenes de 10.000 gana la mas cercana en hora (19:51).
    expect(received10000.linkedOrderNumber).toBe('22941660938720776192')
  })

  it('las ordenes enlazadas quedan marcadas y las demas siguen sin enlazar', () => {
    const bank = bankRows()
    const orders = parseP2pOrderList(groupSegments(P2P_WORDS, 1170), TODAY)

    matchP2pOrders([...bank, ...orders])

    // La tercera orden (10.000 Bs a 990,551) no tiene abono que enlazar en la captura del banco.
    expect(orders.map((order) => order.linkedOrderNumber !== null)).toEqual([true, true, false])
    expect(bank.filter((row) => row.action === 'transfer')).toHaveLength(2)
  })

  it('un gasto del mismo importe no se enlaza con una venta', () => {
    const bank = bankRows()
    const orders = parseP2pOrderList(groupSegments(P2P_WORDS, 1170), TODAY)
    const spent10500 = bank.find((row) => row.amount === 10500)!

    matchP2pOrders([...bank, ...orders])

    expect(spent10500.action).toBe('expense')
  })

  it('un recibido sin orden se mantiene como ingreso', () => {
    const bank = bankRows()

    matchP2pOrders(bank)

    expect(bank.find((row) => row.amount === 26600)!.action).toBe('income')
  })
})

describe('enlace de recibidos con ordenes P2P: nunca sin fecha', () => {
  it('una orden sin fecha legible no se enlaza con un abono del mismo importe (podria ser de otro dia)', () => {
    const bank = bankRows()
    const orders = parseP2pOrderList(groupSegments(P2P_WORDS, 1170), TODAY)
    const withoutDate = orders[2]!
    expect(withoutDate.occurredOn).toBeNull()

    // Un abono de 10.000 Bs de OTRO dia, sin ninguna orden con fecha que coincida.
    const farAway = { ...bank.find((row) => row.amount === 10000)!, occurredOn: '2026-09-20', time: '19:45' }
    matchP2pOrders([farAway, withoutDate])

    expect(farAway.action).not.toBe('transfer')
    expect(withoutDate.linkedOrderNumber).toBeNull()
  })

  it('un abono sin fecha tampoco se enlaza', () => {
    const orders = parseP2pOrderList(groupSegments(P2P_WORDS, 1170), TODAY)
    const undated = { ...bankRows().find((row) => row.amount === 26600)!, occurredOn: null, time: null }

    matchP2pOrders([undated, orders[0]!])

    expect(undated.linkedOrderNumber).toBeNull()
  })
})
