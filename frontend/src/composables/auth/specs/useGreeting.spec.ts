import { describe, expect, it } from 'vitest'
import { firstNameOf, greetingForHour } from '../useGreeting'

describe('greetingForHour', () => {
  it('cambia el saludo segun el tramo del dia', () => {
    expect(greetingForHour(8)).toBe('Buenos días')
    expect(greetingForHour(12)).toBe('Buenas tardes')
    expect(greetingForHour(19)).toBe('Buenas tardes')
    expect(greetingForHour(20)).toBe('Buenas noches')
    expect(greetingForHour(2)).toBe('Buenos días')
  })
})

describe('firstNameOf', () => {
  it('toma la primera palabra del nombre con la inicial en mayuscula', () => {
    expect(firstNameOf('gabriel rodriguez', 'g@x.cl')).toBe('Gabriel')
  })

  it('sin nombre usa la parte local del email', () => {
    expect(firstNameOf(null, 'maria@x.cl')).toBe('Maria')
  })

  it('sin nada devuelve vacio', () => {
    expect(firstNameOf(undefined, undefined)).toBe('')
  })
})
