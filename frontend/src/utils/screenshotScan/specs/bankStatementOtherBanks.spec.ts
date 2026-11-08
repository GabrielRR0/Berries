import { describe, expect, it } from 'vitest'
import { classifyImageKind, rowsFromImage } from '../rowsFromImage'
import { TODAY, genericTableWords, layoutOf, line } from './listFixtures'

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
