import { describe, expect, it } from 'vitest'
import { parseBankList } from '../bankListParser'
import { groupSegments } from '../ocrLayout'
import { resolveDateHeader } from '../movementDictionary'
import { classifyImageKind, rowsFromImage } from '../rowsFromImage'
import {
  BANK_HISTORICO_WORDS,
  BANK_HOY_AYER_GREEN_Y,
  BANK_HOY_AYER_WORDS,
  BANK_WEEKDAY_GREEN_Y,
  BANK_WEEKDAY_WORDS,
  TODAY,
  layoutOf,
} from './listFixtures'

const greenAt = (ys: number[]) => (box: { y0: number }) => ys.includes(box.y0)

describe('encabezados de fecha con dia de la semana', () => {
  it('lee "MIERCOLES, 7 DE OCTUBRE" como el 7 de octubre', () => {
    expect(resolveDateHeader('MIERCOLES, 7 DE OCTUBRE', TODAY)).toBe('2026-10-07')
    expect(resolveDateHeader('Miércoles, 7 de octubre', TODAY)).toBe('2026-10-07')
  })

  it('sin ano, una fecha que caeria en el futuro es del ano anterior', () => {
    expect(resolveDateHeader('28 de diciembre', new Date(2027, 0, 5))).toBe('2026-12-28')
    expect(resolveDateHeader('8 de octubre', TODAY)).toBe('2026-10-08')
  })
})

describe('lista de movimientos con HOY y AYER', () => {
  it('asigna a cada fila el dia de su encabezado', () => {
    const layout = layoutOf(BANK_HOY_AYER_WORDS, 924, greenAt(BANK_HOY_AYER_GREEN_Y))
    const { kind, rows } = rowsFromImage(layout, { today: TODAY, defaultDate: null })

    expect(kind).toBe('bank_list')
    expect(rows.map((row) => [row.amount, row.occurredOn, row.fee, row.direction])).toEqual([
      [1200, '2026-10-09', 14, 'out'],
      [22848, '2026-10-08', 68.54, 'out'],
      [26600, '2026-10-08', 0, 'in'],
    ])
  })
})

describe('lista con encabezado "MIERCOLES, 7 DE OCTUBRE"', () => {
  const layout = layoutOf(BANK_WEEKDAY_WORDS, 924, greenAt(BANK_WEEKDAY_GREEN_Y))

  it('lee gastos con su comision y los dos recibidos en verde', () => {
    const { rows } = rowsFromImage(layout, { today: TODAY, defaultDate: null })

    expect(rows.map((row) => [row.amount, row.fee, row.direction])).toEqual([
      [7000, 21, 'out'],
      [20000, 60, 'out'],
      [20039.9, 0, 'in'],
      [40000, 120, 'out'],
      [40107.74, 0, 'in'],
    ])
    expect(rows.every((row) => row.occurredOn === '2026-10-07')).toBe(true)
    expect(rows.map((row) => row.time)).toEqual(['19:57', '19:44', '19:39', '19:26', '19:22'])
  })

  it('solo gastos: descarta lo recibido', () => {
    const { rows } = rowsFromImage(layout, { today: TODAY, defaultDate: null, scope: 'expenses' })

    expect(rows.map((row) => row.amount)).toEqual([7000, 20000, 40000])
    expect(rows.every((row) => row.direction === 'out')).toBe(true)
  })

  it('solo recibidos: deja unicamente lo recibido', () => {
    const { rows } = rowsFromImage(layout, { today: TODAY, defaultDate: null, scope: 'received' })

    expect(rows.map((row) => row.amount)).toEqual([20039.9, 40107.74])
  })

  it('sin tomar en cuenta las comisiones, las descarta y no las suma a nada', () => {
    const { rows } = rowsFromImage(layout, { today: TODAY, defaultDate: null, includeFees: false })

    expect(rows.map((row) => row.amount)).toEqual([7000, 20000, 20039.9, 40000, 40107.74])
    expect(rows.every((row) => row.fee === 0)).toBe(true)
  })
})

describe('"Historico de operaciones" del inicio de la app', () => {
  const layout = layoutOf(BANK_HISTORICO_WORDS, 924)

  it('se reconoce como lista del banco y no toma el saldo de la cabecera como movimiento', () => {
    expect(classifyImageKind(layout.text)).toBe('bank_list')

    const { rows } = rowsFromImage(layout, { today: TODAY, defaultDate: null })

    expect(rows.map((row) => row.amount)).toEqual([7000, 20000, 40000, 1100, 500])
    expect(rows.every((row) => row.occurredOn === '2026-10-07')).toBe(true)
    expect(rows.map((row) => row.time)).toEqual(['19:57', '19:44', '19:26', '18:43', '18:32'])
    expect(rows[4]!.description).toBe('Pago de Servicios')
    expect(rows[0]!.description).toBe('PagomóvilBDV')
  })

  it('el color no distingue recibido de pagado: sin indicacion se asume gasto y se pide confirmar', () => {
    const { rows } = rowsFromImage(layout, { today: TODAY, defaultDate: null })

    expect(rows.every((row) => row.direction === 'out')).toBe(true)
    expect(rows[0]!.flags.join(' ')).toContain('no distingue gastos de recibidos')
  })

  it('si el usuario dijo "solo gastos" no hace falta confirmar nada', () => {
    const { rows } = rowsFromImage(layout, { today: TODAY, defaultDate: null, scope: 'expenses' })

    expect(rows).toHaveLength(5)
    expect(rows.every((row) => row.direction === 'out' && row.flags.length === 0)).toBe(true)
  })

  it('si el usuario dijo "solo recibidos" todas las filas se toman como recibidas', () => {
    const { rows } = rowsFromImage(layout, { today: TODAY, defaultDate: null, scope: 'received' })

    expect(rows).toHaveLength(5)
    expect(rows.every((row) => row.direction === 'in' && row.action === 'income')).toBe(true)
    expect(rows.every((row) => row.flags.length === 0)).toBe(true)
  })

  it('un monto a la izquierda de la pantalla se ignora aunque tenga formato de monto', () => {
    const rows = parseBankList(groupSegments(BANK_HISTORICO_WORDS, 924), {
      today: TODAY,
      defaultDate: null,
      isGreen: () => null,
      imageWidth: 924,
      colorCodesDirection: false,
    })

    expect(rows.map((row) => row.amount)).not.toContain(3848.1)
  })
})
