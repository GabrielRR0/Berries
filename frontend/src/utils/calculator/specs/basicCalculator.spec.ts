import { describe, expect, it } from 'vitest'
import {
  INITIAL_BASIC_CALCULATOR_STATE,
  pressBackspace,
  pressClear,
  pressDecimal,
  pressDigit,
  pressEquals,
  pressOperator,
  pressPercent,
  pressToggleSign,
} from '../basicCalculator'

function keys(...presses: Array<(s: typeof INITIAL_BASIC_CALCULATOR_STATE) => typeof INITIAL_BASIC_CALCULATOR_STATE>) {
  return presses.reduce((state, press) => press(state), INITIAL_BASIC_CALCULATOR_STATE)
}

const d = (digit: string) => (s: typeof INITIAL_BASIC_CALCULATOR_STATE) => pressDigit(s, digit)
const op = (o: '+' | '-' | '×' | '÷') => (s: typeof INITIAL_BASIC_CALCULATOR_STATE) => pressOperator(s, o)

describe('basicCalculator', () => {
  it('suma dos numeros simples', () => {
    const state = keys(d('5'), op('+'), d('3'), pressEquals)
    expect(state.display).toBe('8')
  })

  it('es secuencial, no respeta precedencia de operadores', () => {
    // 5 + 3 x 2 = (5+3)*2 = 16, no 5+(3*2)=11
    const state = keys(d('5'), op('+'), d('3'), op('×'), d('2'), pressEquals)
    expect(state.display).toBe('16')
  })

  it('encadena un operador nuevo sin perder la cuenta pendiente', () => {
    // 5 + 3 + 2 = 10 (el "+3" del medio se resuelve al tocar el segundo "+")
    const state = keys(d('5'), op('+'), d('3'), op('+'), d('2'), pressEquals)
    expect(state.display).toBe('10')
  })

  it('division por cero muestra error y se limpia con C', () => {
    const errored = keys(d('5'), op('÷'), d('0'), pressEquals)
    expect(errored.display).toBe('Error')
    expect(errored.error).toBe(true)

    const cleared = pressClear(errored)
    expect(cleared).toEqual(INITIAL_BASIC_CALCULATOR_STATE)
  })

  it('evita el error de precision de punto flotante (0.1 + 0.2)', () => {
    const state = keys(d('0'), pressDecimal, d('1'), op('+'), d('0'), pressDecimal, d('2'), pressEquals)
    expect(state.display).toBe('0.3')
  })

  it('el punto decimal no se puede repetir en el mismo numero', () => {
    const state = keys(d('1'), pressDecimal, d('5'), pressDecimal, d('5'))
    expect(state.display).toBe('1.55')
  })

  it('porcentaje divide el display actual por 100', () => {
    const state = keys(d('5'), d('0'), pressPercent)
    expect(state.display).toBe('0.5')
  })

  it('backspace borra el ultimo digito, sin borrar despues de un operador/resultado', () => {
    const mid = keys(d('1'), d('2'), d('3'), pressBackspace)
    expect(mid.display).toBe('12')

    // Justo despues de "=" o un operador (overwrite:true) no borra nada -
    // evita que backspace corrompa el resultado recien calculado.
    const afterEquals = keys(d('5'), op('+'), d('3'), pressEquals, pressBackspace)
    expect(afterEquals.display).toBe('8')
  })

  it('cambia el signo del numero actual', () => {
    const state = keys(d('5'), pressToggleSign)
    expect(state.display).toBe('-5')
    expect(pressToggleSign(state).display).toBe('5')
  })

  it('tocar un digito despues de "=" arranca una cuenta nueva desde cero', () => {
    const afterEquals = keys(d('5'), op('+'), d('3'), pressEquals)
    const state = pressDigit(afterEquals, '7')
    expect(state.display).toBe('7')
    expect(state.pendingOperator).toBeNull()
  })
})
