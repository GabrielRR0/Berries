import { describe, expect, it } from 'vitest'
import { parseBankStatement } from '../bankStatementParser'
import { rowFingerprint } from '../rowFingerprint'
import { classifyImageKind, rowsFromImage } from '../rowsFromImage'
import { BANK_STATEMENT_WORDS, STATEMENT_ROWS, TODAY, genericTableWords, layoutOf, line, statementWords } from './listFixtures'

const WIDTH = 1918
const layout = layoutOf(BANK_STATEMENT_WORDS, WIDTH)

function read(options: Parameters<typeof rowsFromImage>[1] = { today: TODAY, defaultDate: null }) {
  return rowsFromImage(layout, options).rows
}

describe('estado de cuenta en tabla (BDVenlinea personas)', () => {
  it('se reconoce por sus columnas', () => {
    expect(layout.text).toContain('Referencia')
    expect(classifyImageKind(layout.text)).toBe('bank_statement')
  })

  it('una lista del celular no se confunde con un estado de cuenta', () => {
    expect(classifyImageKind('Movimientos AYER Cobro comision 10:25 PM 68,54 Bs Operacion 10:25 PM 22.848,00 Bs')).toBe('bank_list')
  })

  it('lee cada fila con su sentido explicito, fecha, hora y referencia', () => {
    const rows = read()

    expect(rows.map((row) => [row.amount, row.direction, row.occurredOn, row.time, row.reference])).toEqual([
      [16000, 'in', '2026-09-20', '19:58', '0677241403397'],
      [20000, 'in', '2026-09-20', '19:52', '0677208897420'],
      [10000, 'in', '2026-09-20', '19:45', '0677208813375'],
      [5100, 'out', '2026-09-18', '19:48', '0677286173620'],
      [500, 'out', '2026-09-18', '18:51', '0677285322989'],
      [2500, 'out', '2026-09-18', '09:56', '0050377649985'],
      [4850, 'out', '2026-09-17', '20:53', '0677274279899'],
      [6000, 'in', '2026-09-17', '19:53', '0677273495969'],
      [12697.7, 'in', '2026-09-16', '20:26', '0677260573326'],
    ])
    expect(rows.every((row) => row.currency === 'VEF' && row.source === 'bank')).toBe(true)
  })

  it('une cada comision con la operacion de la misma hora, incluidas las de descripcion distinta', () => {
    const rows = read()

    expect(rows.map((row) => row.fee)).toEqual([0, 0, 0, 15.3, 14, 14, 14.55, 0, 0])
    expect(rows.some((row) => /comision/i.test(row.description))).toBe(false)
  })

  it('une las descripciones de varias lineas y no mezcla columnas', () => {
    const rows = read()

    expect(rows[0]!.description).toBe('OPERACION PAGOMOVIL BDV')
    expect(rows[5]!.description).toBe('OPERACION PAGOMOVILBDV OTROS BANCO')
  })

  it('el saldo del banco cuadra con cada movimiento: ninguna fila queda marcada', () => {
    expect(read().every((row) => row.flags.length === 0)).toBe(true)
  })

  it('si el OCR lee mal un monto, el saldo lo delata y marca esa fila', () => {
    const corrupted = STATEMENT_ROWS.map((row) => (row.amount === '-5.100,00' ? { ...row, amount: '-5.700,00' } : row))
    const rows = rowsFromImage(layoutOf(statementWords(corrupted), WIDTH), { today: TODAY, defaultDate: null }).rows

    const flagged = rows.filter((row) => row.flags.some((flag) => flag.includes('saldo del banco no cuadra')))
    expect(flagged.map((row) => row.amount)).toEqual([5700])
  })

  it('"solo gastos" y "solo ingresos" usan el debito o credito de cada fila', () => {
    const expenses = read({ today: TODAY, defaultDate: null, scope: 'expenses' })
    const received = read({ today: TODAY, defaultDate: null, scope: 'received' })

    expect(expenses.map((row) => row.amount)).toEqual([5100, 500, 2500, 4850])
    expect(received.map((row) => row.amount)).toEqual([16000, 20000, 10000, 6000, 12697.7])
  })

  it('sin tomar en cuenta las comisiones, las descarta', () => {
    const rows = read({ today: TODAY, defaultDate: null, includeFees: false })

    expect(rows).toHaveLength(9)
    expect(rows.every((row) => row.fee === 0)).toBe(true)
  })

  it('la referencia del banco identifica cada movimiento (huella contra duplicados)', () => {
    const [first] = read()

    expect(rowFingerprint(first!)).toBe('ref|VEF|0677241403397|in')
  })

  it('el saldo es opcional: sin su titulo la tabla se lee igual, solo sin la comprobacion', () => {
    const withoutBalance = BANK_STATEMENT_WORDS.filter((word) => word.text !== 'Saldo')

    const rows = parseBankStatement(withoutBalance, { imageWidth: WIDTH, defaultDate: null })

    expect(rows.map((row) => row.amount)).toEqual([16000, 20000, 10000, 5100, 500, 2500, 4850, 6000, 12697.7])
  })

  it('sin el titulo del monto no hay forma de leerla: devuelve vacio en vez de inventar', () => {
    const withoutAmount = BANK_STATEMENT_WORDS.filter((word) => word.text !== 'Monto')

    expect(parseBankStatement(withoutAmount, { imageWidth: WIDTH, defaultDate: null })).toEqual([])
  })

  it('si no se lee la fecha de una fila se usa la elegida al inicio, se avisa y NO se mezcla con la vecina', () => {
    // Se pierde la fecha y la hora de la primera fila (y = 144; sus palabras estan a la izquierda de la referencia).
    const noDate = BANK_STATEMENT_WORDS.filter((word) => !(word.y0 === 136 && word.x0 < 640))
    const rows = parseBankStatement(noDate, { imageWidth: WIDTH, defaultDate: '2026-09-21' })

    expect(rows).toHaveLength(9)
    expect(rows[0]).toMatchObject({ amount: 16000, direction: 'in', occurredOn: '2026-09-21', time: null })
    expect(rows[0]!.flags.join(' ')).toContain('No se leyó la fecha')
    // La fila siguiente sigue intacta.
    expect(rows[1]).toMatchObject({ amount: 20000, occurredOn: '2026-09-20', time: '19:52' })
  })

  it('una letra mal leida en DEBITO / CREDITO no desordena las filas', () => {
    const noisy = BANK_STATEMENT_WORDS.map((word) => (word.text === 'DEBITO' ? { ...word, text: 'DEBTO' } : word))
    const rows = parseBankStatement(noisy, { imageWidth: WIDTH, defaultDate: null })

    // "DEBTO" ya no dice debito del todo, pero sigue ubicando la fila y el signo del monto da el sentido.
    expect(rows).toHaveLength(9)
    expect(rows.filter((row) => row.direction === 'out').map((row) => row.amount)).toEqual([5100, 500, 2500, 4850])
  })
})

// Otros bancos: la misma tabla con otros titulos y otra forma de repartir debito y credito.
describe('estados de cuenta de otros bancos (por sinonimos, sin codigo nuevo)', () => {
  const read = (words: ReturnType<typeof genericTableWords>) =>
    rowsFromImage(layoutOf(words, 1500), { today: TODAY, defaultDate: null })

  it('columnas de Debito y Credito SEPARADAS (con Concepto y Nro. de operacion)', () => {
    const words = genericTableWords(
      [
        ['Fecha', 100],
        ['Nro. Operacion', 230],
        ['Concepto', 420],
        ['Debito', 760],
        ['Credito', 900],
        ['Saldo', 1040],
      ],
      [
        { y: 150, cells: ['21/09/2026', '88120044', ['PAGO MOVIL', 'RECIBIDO'], '', '25.000,00', '60.500,00'] },
        { y: 210, cells: ['21/09/2026', '88119931', 'COMPRA SUPERMERCADO', '3.500,00', '', '35.500,00'] },
        { y: 270, cells: ['20/09/2026', '88100210', 'COMISION SERVICIO', '12,00', '', '39.000,00'] },
      ],
    )
    const { kind, rows } = read(words)

    expect(kind).toBe('bank_statement')
    expect(rows.map((row) => [row.amount, row.direction, row.occurredOn, row.reference])).toEqual([
      [25000, 'in', '2026-09-21', '88120044'],
      [3500, 'out', '2026-09-21', '88119931'],
      [12, 'out', '2026-09-20', '88100210'],
    ])
    expect(rows[0]!.description).toBe('PAGO MOVIL RECIBIDO')
    // El saldo cuadra: 35.500 + 25.000 = 60.500; 39.000 - 3.500 = 35.500.
    expect(rows.every((row) => row.flags.length === 0)).toBe(true)
  })

  it('un solo monto con SIGNO (Importe), sin referencia ni saldo', () => {
    const words = genericTableWords(
      [
        ['Fecha', 100],
        ['Detalle', 260],
        ['Importe', 700],
      ],
      [
        { y: 150, cells: ['22/09/2026', 'TRANSFERENCIA RECIBIDA', '12.000,00'] },
        { y: 210, cells: ['22/09/2026', 'PAGO SERVICIOS', '-1.250,50'] },
        { y: 270, cells: ['21/09/2026', 'RETIRO CAJERO', '-2.000,00'] },
      ],
    )
    const { kind, rows } = read(words)

    expect(kind).toBe('bank_statement')
    expect(rows.map((row) => [row.amount, row.direction])).toEqual([
      [12000, 'in'],
      [1250.5, 'out'],
      [2000, 'out'],
    ])
    expect(rows.every((row) => row.reference === null)).toBe(true)
  })

  it('un "Fecha desde" de un filtro encima de la tabla no se confunde con el titulo de la columna', () => {
    const filterWords = [...line('Fecha', 100, 140, 30, 46), ...line('desde', 148, 190, 30, 46), ...line('Buscar', 700, 760, 30, 46)]
    const words = genericTableWords(
      [
        ['Fecha', 100],
        ['Descripcion', 260],
        ['Monto', 700],
      ],
      [
        { y: 150, cells: ['22/09/2026', 'COMPRA', '-500,00'] },
        { y: 210, cells: ['21/09/2026', 'DEPOSITO', '900,00'] },
        { y: 270, cells: ['20/09/2026', 'PAGO', '-100,00'] },
      ],
      filterWords,
    )

    expect(read(words).rows.map((row) => [row.amount, row.direction])).toEqual([
      [500, 'out'],
      [900, 'in'],
      [100, 'out'],
    ])
  })

  it('un comprobante con una sola fecha no se toma por estado de cuenta', () => {
    expect(classifyImageKind('Comprobante Fecha 22/09/2026 Concepto pago Monto 500,00')).not.toBe('bank_statement')
  })

  it('si parece una tabla pero no se logran ubicar las columnas, prueba los otros lectores en vez de fallar', () => {
    // Tiene los titulos en el texto, pero sin palabras con posicion no hay columnas que ubicar.
    const text = 'Fecha Concepto Monto 01-01-2026 a 02-01-2026 b 03-01-2026 c'
    const result = rowsFromImage({ text, words: [], width: 1500, isGreen: () => null }, { today: TODAY, defaultDate: null })

    expect(result.rows).toEqual([])
    expect(result.kind).not.toBe('bank_statement')
  })
})
