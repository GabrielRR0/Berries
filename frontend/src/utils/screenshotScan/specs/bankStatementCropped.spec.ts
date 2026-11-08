import { describe, expect, it } from 'vitest'
import { parseBankStatement } from '../bankStatement'
import { classifyImageKind, rowsFromImage } from '../rowsFromImage'
import { BANK_STATEMENT_WORDS, TODAY, layoutOf } from './listFixtures'

const WIDTH = 1918

describe('captura recortada', () => {
  const headerBottom = Math.max(...BANK_STATEMENT_WORDS.filter((word) => word.text === 'Fecha').map((word) => word.y1))
  const withoutTitles = BANK_STATEMENT_WORDS.filter((word) => word.y0 > headerBottom + 5)
  const amounts = (rows: ReturnType<typeof parseBankStatement>) => rows.map((row) => row.amount)

  it('sin la fila de titulos deduce las columnas de donde caen los datos', () => {
    const rows = parseBankStatement(withoutTitles, { imageWidth: WIDTH, defaultDate: null })

    expect(amounts(rows)).toEqual([16000, 20000, 10000, 5100, 500, 2500, 4850, 6000, 12697.7])
    expect(rows.map((row) => row.fee)).toEqual([0, 0, 0, 15.3, 14, 14, 14.55, 0, 0])
    expect(rows[0]).toMatchObject({ direction: 'in', occurredOn: '2026-09-20', time: '19:58', reference: '0677241403397' })
    expect(rows.every((row) => row.flags.length === 0)).toBe(true)
  })

  it('sin titulos, se reconoce por sus filas como estado de cuenta', () => {
    const text = layoutOf(withoutTitles, WIDTH).text

    expect(classifyImageKind(text)).toBe('bank_statement')
    expect(rowsFromImage(layoutOf(withoutTitles, WIDTH), { today: TODAY, defaultDate: null }).rows).toHaveLength(9)
  })

  it('con los titulos a la vista, dos filas bastan', () => {
    const firstTwoRows = BANK_STATEMENT_WORDS.filter((word) => word.y0 < 250)
    const { kind, rows } = rowsFromImage(layoutOf(firstTwoRows, WIDTH), { today: TODAY, defaultDate: null })

    expect(kind).toBe('bank_statement')
    expect(amounts(rows)).toEqual([16000, 20000])
  })

  it('un resto de fila cortado por el borde (sin fecha ni referencia) no se toma por un movimiento', () => {
    const sliver = [
      { text: '25.53', x0: 1137, x1: 1190, y0: 100, y1: 115 },
      { text: 'DEBITO', x0: 959, x1: 1013, y0: 100, y1: 115 },
    ]
    const rows = parseBankStatement([...withoutTitles, ...sliver], { imageWidth: WIDTH, defaultDate: null })

    expect(amounts(rows)).toEqual([16000, 20000, 10000, 5100, 500, 2500, 4850, 6000, 12697.7])
  })

  it('con muy pocos datos no inventa columnas', () => {
    const one = withoutTitles.filter((word) => word.y0 < 150)

    expect(parseBankStatement(one, { imageWidth: WIDTH, defaultDate: null })).toEqual([])
  })
})
