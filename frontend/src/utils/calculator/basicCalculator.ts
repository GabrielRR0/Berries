// Motor de la calculadora basica: secuencial (como una calculadora fisica),
// NO respeta precedencia de operadores (5 + 3 x 2 da 16, no 11) - es el
// comportamiento esperado de una calculadora de 4 funciones, a diferencia de
// una calculadora cientifica. Reducer puro (sin estado propio) para que sea
// facil de testear sin montar el componente Vue.

export type BasicOperator = '+' | '-' | '×' | '÷'

export interface BasicCalculatorState {
  display: string
  previousValue: number | null
  pendingOperator: BasicOperator | null
  // true justo despues de tocar un operador o "=" - el proximo digito
  // arranca una entrada nueva en vez de agregarse al final del display.
  overwrite: boolean
  error: boolean
}

export const INITIAL_BASIC_CALCULATOR_STATE: BasicCalculatorState = {
  display: '0',
  previousValue: null,
  pendingOperator: null,
  overwrite: true,
  error: false,
}

const MAX_DISPLAY_LENGTH = 12

// Redondeo a 10 decimales para evitar el clasico 0.1+0.2=0.30000000000000004
// de punto flotante, sin perder precision util para montos de dinero.
function round(value: number): number {
  return Math.round(value * 1e10) / 1e10
}

function formatResult(value: number): string {
  const rounded = round(value)
  const str = rounded.toString()
  return str.length > MAX_DISPLAY_LENGTH ? rounded.toExponential(5) : str
}

function compute(a: number, operator: BasicOperator, b: number): number | null {
  switch (operator) {
    case '+':
      return round(a + b)
    case '-':
      return round(a - b)
    case '×':
      return round(a * b)
    case '÷':
      return b === 0 ? null : round(a / b)
  }
}

export function pressDigit(state: BasicCalculatorState, digit: string): BasicCalculatorState {
  if (state.error) return pressClear(state)

  if (state.overwrite) {
    return { ...state, display: digit, overwrite: false }
  }
  if (state.display === '0') {
    return { ...state, display: digit }
  }
  if (state.display.replace('-', '').length >= MAX_DISPLAY_LENGTH) {
    return state
  }
  return { ...state, display: state.display + digit }
}

export function pressDecimal(state: BasicCalculatorState): BasicCalculatorState {
  if (state.error) return pressClear(state)

  if (state.overwrite) {
    return { ...state, display: '0.', overwrite: false }
  }
  if (state.display.includes('.')) return state
  return { ...state, display: `${state.display}.` }
}

export function pressOperator(state: BasicCalculatorState, operator: BasicOperator): BasicCalculatorState {
  if (state.error) return state

  const current = Number(state.display)

  // Encadenado: si ya habia un operador pendiente y el usuario ya escribio
  // un numero nuevo (no esta en "overwrite"), resuelve esa cuenta primero
  // antes de guardar el operador nuevo - asi "5 + 3 + 2 =" da 10, no se
  // pierde el "+3" del medio.
  if (state.pendingOperator !== null && !state.overwrite) {
    const result = compute(state.previousValue ?? 0, state.pendingOperator, current)
    if (result === null) return { ...state, display: 'Error', error: true }
    return { ...state, display: formatResult(result), previousValue: result, pendingOperator: operator, overwrite: true }
  }

  return { ...state, previousValue: current, pendingOperator: operator, overwrite: true }
}

export function pressEquals(state: BasicCalculatorState): BasicCalculatorState {
  if (state.error) return state
  if (state.pendingOperator === null || state.previousValue === null) return state

  const result = compute(state.previousValue, state.pendingOperator, Number(state.display))
  if (result === null) return { ...state, display: 'Error', error: true, pendingOperator: null, previousValue: null }

  return {
    display: formatResult(result),
    previousValue: null,
    pendingOperator: null,
    overwrite: true,
    error: false,
  }
}

export function pressPercent(state: BasicCalculatorState): BasicCalculatorState {
  if (state.error) return pressClear(state)
  return { ...state, display: formatResult(Number(state.display) / 100), overwrite: true }
}

export function pressBackspace(state: BasicCalculatorState): BasicCalculatorState {
  if (state.error || state.overwrite) return state

  const next = state.display.slice(0, -1)
  if (next === '' || next === '-') return { ...state, display: '0' }
  return { ...state, display: next }
}

export function pressClear(_state: BasicCalculatorState): BasicCalculatorState {
  return INITIAL_BASIC_CALCULATOR_STATE
}

export function pressToggleSign(state: BasicCalculatorState): BasicCalculatorState {
  if (state.error || state.display === '0') return state
  const next = state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}`
  return { ...state, display: next }
}
