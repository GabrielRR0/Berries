import { describe, expect, it } from 'vitest'
import { groupAmountThousands, ungroupAmountThousands } from '../formatAmountInput'

describe('groupAmountThousands', () => {
  it('agrupa la parte entera de a miles con comas', () => {
    expect(groupAmountThousands('1300')).toBe('1,300')
    expect(groupAmountThousands('233222')).toBe('233,222')
    expect(groupAmountThousands('1000000')).toBe('1,000,000')
  })

  it('no toca numeros de menos de 4 digitos', () => {
    expect(groupAmountThousands('0')).toBe('0')
    expect(groupAmountThousands('999')).toBe('999')
  })

  it('deja la parte decimal intacta, sin agruparla', () => {
    expect(groupAmountThousands('1300.5')).toBe('1,300.5')
    expect(groupAmountThousands('1300.50')).toBe('1,300.50')
  })

  it('conserva un punto final mientras se sigue escribiendo el decimal', () => {
    expect(groupAmountThousands('1300.')).toBe('1,300.')
  })

  it('con string vacio, devuelve string vacio', () => {
    expect(groupAmountThousands('')).toBe('')
  })
})

describe('ungroupAmountThousands', () => {
  it('saca las comas de agrupamiento', () => {
    expect(ungroupAmountThousands('1,300')).toBe('1300')
    expect(ungroupAmountThousands('233,222')).toBe('233222')
  })

  it('conserva el punto decimal', () => {
    expect(ungroupAmountThousands('1,300.50')).toBe('1300.50')
  })

  it('conserva solo el primer punto si hay varios (edicion a medio escribir)', () => {
    expect(ungroupAmountThousands('1,300..5')).toBe('1300.5')
  })

  it('descarta cualquier otro caracter que no sea digito o punto', () => {
    expect(ungroupAmountThousands('$1,300 USD')).toBe('1300')
  })

  it('con string vacio, devuelve string vacio', () => {
    expect(ungroupAmountThousands('')).toBe('')
  })
})
