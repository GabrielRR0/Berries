import { describe, expect, it } from 'vitest'
import { parseBankStatement } from '../bankStatement'
import { rowFingerprint } from '../rowFingerprint'
import { classifyImageKind, rowsFromImage } from '../rowsFromImage'
import { BANK_STATEMENT_WORDS, STATEMENT_ROWS, TODAY, layoutOf, statementWords } from './listFixtures'

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

  it('sin el titulo del monto, igual deduce la columna por la forma de las cifras (y el saldo sigue comprobando)', () => {
    const withoutAmount = BANK_STATEMENT_WORDS.filter((word) => word.text !== 'Monto')

    const rows = parseBankStatement(withoutAmount, { imageWidth: WIDTH, defaultDate: null })

    expect(rows.map((row) => row.amount)).toEqual([16000, 20000, 10000, 5100, 500, 2500, 4850, 6000, 12697.7])
    expect(rows.every((row) => row.flags.length === 0)).toBe(true)
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

  it('una palabra de tipo ilegible por completo ("DEBITO" -> "pero") no funde la fila con la vecina', () => {
    // Pasa con las capturas reales de BDV: se pierde la fila entera y su comision.
    let seen = 0
    const unreadable = BANK_STATEMENT_WORDS.map((word) => (word.text === 'DEBITO' && seen++ === 3 ? { ...word, text: 'pero' } : word))
    const rows = parseBankStatement(unreadable, { imageWidth: WIDTH, defaultDate: null })

    expect(rows).toHaveLength(9)
    expect(rows.map((row) => [row.amount, row.direction, row.fee])).toEqual(
      parseBankStatement(BANK_STATEMENT_WORDS, { imageWidth: WIDTH, defaultDate: null }).map((row) => [row.amount, row.direction, row.fee]),
    )
    // El monto lleva "-": es un debito seguro, no hace falta pedir revision.
    expect(rows.every((row) => row.flags.length === 0)).toBe(true)
  })

  it('los titulos mal leidos por el OCR ("Monto" -> "Monte", "Saldo" -> "Salde") no impiden leer la tabla', () => {
    const misread = BANK_STATEMENT_WORDS.map((word) =>
      word.text === 'Monto' ? { ...word, text: 'Monte' } : word.text === 'Saldo' ? { ...word, text: 'Salde' } : word,
    )
    const rows = parseBankStatement(misread, { imageWidth: WIDTH, defaultDate: null })

    expect(rows).toHaveLength(9)
    expect(rows.every((row) => row.flags.length === 0)).toBe(true)
  })

  it('el titulo "Crédito" deformado ("Créditc") sigue siendo la columna de tipo, aunque el OCR pierda los signos "-"', () => {
    // Pasa con una captura recortada real: sin la columna de credito el lector tomaba la tabla por "monto con
    // signo" y, sin signos, marcaba todos los gastos como ingresos.
    const misread = BANK_STATEMENT_WORDS.map((word) => {
      if (word.text === 'Crédito') return { ...word, text: 'Créditc' }
      return /^-\d/.test(word.text) ? { ...word, text: word.text.slice(1) } : word
    })
    const rows = parseBankStatement(misread, { imageWidth: WIDTH, defaultDate: null })

    expect(rows.map((row) => [row.amount, row.direction])).toEqual(
      parseBankStatement(BANK_STATEMENT_WORDS, { imageWidth: WIDTH, defaultDate: null }).map((row) => [row.amount, row.direction]),
    )
    expect(rows.filter((row) => row.direction === 'out')).toHaveLength(4)
  })

  it('las palabras fantasma de Tesseract (fragmentos de 1 px o tapados por otra palabra) no desordenan las filas', () => {
    const first = BANK_STATEMENT_WORDS.find((word) => word.text === '0677241403397')!
    const ghosts = [
      // Un pedazo de la referencia, con su mismo alto, encima de ella.
      { text: '4', x0: first.x0 + 20, x1: first.x0 + 28, y0: first.y0, y1: first.y1 },
      // Un fragmento de 2 px de alto en la columna del monto.
      { text: '.000,', x0: 1146, x1: 1179, y0: first.y1 + 5, y1: first.y1 + 7 },
    ]
    const rows = parseBankStatement([...BANK_STATEMENT_WORDS, ...ghosts], { imageWidth: WIDTH, defaultDate: null })

    expect(rows).toHaveLength(9)
    expect(rows[0]).toMatchObject({ amount: 16000, reference: '0677241403397' })
  })

  it('un pedazo de monto inventado ("-14,") de altura normal, entre dos filas, no crea una fila nueva', () => {
    const first = BANK_STATEMENT_WORDS.find((word) => word.text === '0677241403397')!
    const fragment = { text: '-14,', x0: 1137, x1: 1163, y0: first.y1 + 25, y1: first.y1 + 37 }

    const rows = parseBankStatement([...BANK_STATEMENT_WORDS, fragment], { imageWidth: WIDTH, defaultDate: null })

    expect(rows.map((row) => row.amount)).toEqual([16000, 20000, 10000, 5100, 500, 2500, 4850, 6000, 12697.7])
  })

  it('una letra mal leida en DEBITO / CREDITO no desordena las filas', () => {
    const noisy = BANK_STATEMENT_WORDS.map((word) => (word.text === 'DEBITO' ? { ...word, text: 'DEBTO' } : word))
    const rows = parseBankStatement(noisy, { imageWidth: WIDTH, defaultDate: null })

    // "DEBTO" ya no dice debito del todo, pero sigue ubicando la fila y el signo del monto da el sentido.
    expect(rows).toHaveLength(9)
    expect(rows.filter((row) => row.direction === 'out').map((row) => row.amount)).toEqual([5100, 500, 2500, 4850])
  })
})
