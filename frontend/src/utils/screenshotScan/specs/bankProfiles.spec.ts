import { describe, expect, it } from 'vitest'
import { BANK_OPTIONS, DEFAULT_BANK_ID, getProfile, parseBankStatement, toBankId } from '../bankStatement'
import { classifyImageKind, rowsFromImage } from '../rowsFromImage'
import { BANK_STATEMENT_WORDS, TODAY, layoutOf } from './listFixtures'

const WIDTH = 1918

describe('perfiles de banco del estado de cuenta', () => {
  it('hoy solo existe Banco de Venezuela, y es el de por defecto', () => {
    expect(BANK_OPTIONS).toEqual([{ id: 'bdv', label: 'Banco de Venezuela' }])
    expect(DEFAULT_BANK_ID).toBe('bdv')
    expect(getProfile().id).toBe('bdv')
  })

  it('un banco desconocido o vacio cae en el de por defecto', () => {
    expect(toBankId('bdv')).toBe('bdv')
    expect(toBankId('otro-banco')).toBe('bdv')
    expect(toBankId('')).toBe('bdv')
    expect(toBankId(null)).toBe('bdv')
    expect(toBankId(undefined)).toBe('bdv')
  })

  it('el perfil de BDV trae lo que es de BDV: moneda, cifras y comisiones por referencia', () => {
    const bdv = getProfile('bdv')

    expect(bdv.currency).toBe('VEF')
    expect(bdv.numberLocale).toBe('es')
    expect(bdv.feeReferenceSuffixDigits).toBe(7)
    expect(['-25.000,00', '29.910,06', '876,72'].every((amount) => bdv.amountShape.test(amount))).toBe(true)
    expect(['25.000', 'abc', '1,5'].some((amount) => bdv.amountShape.test(amount))).toBe(false)
    expect(bdv.referenceShape.test('0677256690755')).toBe(true)
    expect(bdv.typeWord.test('debito')).toBe(true)
  })

  it('elegir BDV explicitamente da lo mismo que no elegir', () => {
    const byDefault = parseBankStatement(BANK_STATEMENT_WORDS, { imageWidth: WIDTH, defaultDate: null })
    const explicit = parseBankStatement(BANK_STATEMENT_WORDS, { imageWidth: WIDTH, defaultDate: null, bank: 'bdv' })

    expect(explicit.map((row) => [row.amount, row.fee, row.currency])).toEqual(byDefault.map((row) => [row.amount, row.fee, row.currency]))
    expect(explicit.every((row) => row.currency === 'VEF')).toBe(true)
  })

  it('el banco elegido llega hasta la lectura de la captura', () => {
    const layout = layoutOf(BANK_STATEMENT_WORDS, WIDTH)

    expect(classifyImageKind(layout.text, { bank: 'bdv' })).toBe('bank_statement')
    expect(rowsFromImage(layout, { today: TODAY, defaultDate: null, bank: 'bdv' }).rows).toHaveLength(9)
  })
})
