import { describe, expect, it } from 'vitest'
import { padDigitsToLength, parseFormattedAmount } from '../parseFormattedAmount'

describe('parseFormattedAmount', () => {
  it('separa el simbolo prefijo, los digitos y los separadores (USD, en-US)', () => {
    const result = parseFormattedAmount('$1,549.50')
    expect(result.prefix).toBe('$')
    expect(result.digits).toEqual([1, 5, 4, 9, 5, 0])
    expect(result.separators).toEqual([
      { afterDigitIndex: 1, char: ',' },
      { afterDigitIndex: 4, char: '.' },
    ])
    expect(result.suffix).toBe('')
  })

  it('separa el sufijo de letras (USDT)', () => {
    const result = parseFormattedAmount('1514.50 USDT')
    expect(result.prefix).toBe('')
    expect(result.digits).toEqual([1, 5, 1, 4, 5, 0])
    expect(result.suffix).toBe(' USDT')
  })

  it('funciona con un simbolo sufijo (EUR, de-DE: separadores invertidos)', () => {
    const result = parseFormattedAmount('1.549,50 €')
    expect(result.digits).toEqual([1, 5, 4, 9, 5, 0])
    expect(result.separators).toEqual([
      { afterDigitIndex: 1, char: '.' },
      { afterDigitIndex: 4, char: ',' },
    ])
    expect(result.suffix).toBe(' €')
  })

  it('sin ningun digito (balance oculto, "••••••") devuelve todo como prefix', () => {
    const result = parseFormattedAmount('••••••')
    expect(result.digits).toEqual([])
    expect(result.prefix).toBe('••••••')
  })
})

describe('padDigitsToLength', () => {
  it('rellena con ceros a la izquierda hasta la cantidad pedida', () => {
    expect(padDigitsToLength(5, 6)).toEqual([0, 0, 0, 5, 0, 0])
  })

  it('con 0 devuelve todo ceros', () => {
    expect(padDigitsToLength(0, 4)).toEqual([0, 0, 0, 0])
  })

  it('usa el valor absoluto (sin signo negativo)', () => {
    // -95 -> 9500 centavos -> "95.00" en 4 digitos
    expect(padDigitsToLength(-95, 4)).toEqual([9, 5, 0, 0])
  })

  it('digitCount 0 devuelve un array vacio', () => {
    expect(padDigitsToLength(123, 0)).toEqual([])
  })
})
