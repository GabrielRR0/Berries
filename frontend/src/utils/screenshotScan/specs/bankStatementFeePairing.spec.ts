import { describe, expect, it } from 'vitest'
import { parseBankStatement } from '../bankStatement'
import { STATEMENT_ROWS, statementWords } from './listFixtures'

const WIDTH = 1918

// El OCR real deforma las descripciones ("Eo BDV", "OM DON FAG"): las comisiones se unen por la referencia.
describe('comisiones unidas por referencia (sin depender de la descripcion)', () => {
  const garbled = STATEMENT_ROWS.map((row) => ({
    ...row,
    desc: row.desc[0]!.startsWith('COBRO') || row.desc[0]!.startsWith('COMISION') ? ['OM DON FAG'] : ['Eo BDV'],
  }))
  const read = (rows = garbled) => parseBankStatement(statementWords(rows), { imageWidth: WIDTH, defaultDate: null })

  it('con descripciones ilegibles igual une cada comision con su operacion', () => {
    const rows = read()

    expect(rows).toHaveLength(9)
    expect(rows.map((row) => [row.amount, row.fee])).toEqual([
      [16000, 0],
      [20000, 0],
      [10000, 0],
      [5100, 15.3],
      [500, 14],
      [2500, 14],
      [4850, 14.55],
      [6000, 0],
      [12697.7, 0],
    ])
  })

  it('dos movimientos de la misma hora con referencias distintas NO se unen', () => {
    const rows = read(
      garbled.map((row) => (row.ref === '0210086173620' ? { ...row, ref: '0210086999999' } : row)),
    )

    // La comision de 15,30 ya no comparte las cifras finales con su operacion: queda aparte.
    expect(rows).toHaveLength(10)
    expect(rows.find((row) => row.amount === 5100)!.fee).toBe(0)
  })

  it('mismas cifras de referencia pero a otra hora NO se unen', () => {
    const rows = read(garbled.map((row) => (row.ref === '0210086173620' ? { ...row, time: '19:49' } : row)))

    expect(rows.find((row) => row.amount === 5100)!.fee).toBe(0)
  })

  it('dos ingresos con referencias parecidas no se confunden con una comision', () => {
    const twoCredits = garbled.map((row) =>
      row.ref === '0677208897420' ? { ...row, time: '19:58', ref: '0999241403397' } : row,
    )

    const rows = read(twoCredits)

    // El credito de 16.000 y el de 20.000 (ahora a la misma hora y con las mismas cifras finales) son ingresos: se dejan tal cual.
    expect(rows.filter((row) => row.direction === 'in').map((row) => row.amount)).toEqual([16000, 20000, 10000, 6000, 12697.7])
  })
})
