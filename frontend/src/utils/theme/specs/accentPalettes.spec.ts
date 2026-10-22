import { beforeEach, describe, expect, it } from 'vitest'
import { ACCENT_PALETTES, DEFAULT_ACCENT_ID, accentCssVariables, findAccentPalette, hexToRgbTriplet } from '../accentPalettes'
import { loadAccentPreference, saveAccentPreference } from '../accentPreferenceStorage'

describe('accentPalettes', () => {
  it('el rojo original es la primera paleta y la de por defecto', () => {
    expect(DEFAULT_ACCENT_ID).toBe('red')
    expect(ACCENT_PALETTES[0].id).toBe('red')
    expect(ACCENT_PALETTES.map((p) => p.id)).toEqual(['red', 'blue', 'sky', 'green', 'pink', 'purple'])
  })

  it('convierte un hex en la terna rgb que usa el CSS', () => {
    expect(hexToRgbTriplet('#ef4444')).toBe('239, 68, 68')
  })

  it('una paleta desconocida cae al rojo', () => {
    expect(findAccentPalette('nope').id).toBe('red')
    expect(findAccentPalette(null).id).toBe('red')
  })

  it('expone todas las variables que style.css marca como (tema)', () => {
    expect(Object.keys(accentCssVariables(findAccentPalette('blue'))).sort()).toEqual([
      '--accent-bright-rgb',
      '--accent-contrast',
      '--accent-rgb',
      '--accent-soft',
      '--accent-softer',
      '--accent-strong-rgb',
      '--accent-tint',
      '--on-accent-bright',
    ])
  })
})

describe('accentPreferenceStorage', () => {
  beforeEach(() => localStorage.clear())

  it('sin valor guardado devuelve el rojo', () => {
    expect(loadAccentPreference()).toBe('red')
  })

  it('guarda y recupera una eleccion valida', () => {
    saveAccentPreference('purple')
    expect(loadAccentPreference()).toBe('purple')
  })

  it('ignora un valor guardado que ya no existe', () => {
    localStorage.setItem('berry_accent_color', 'turquesa')
    expect(loadAccentPreference()).toBe('red')
  })
})
