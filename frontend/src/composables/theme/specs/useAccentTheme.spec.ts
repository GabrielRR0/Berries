import { beforeEach, describe, expect, it } from 'vitest'
import { initAccentTheme, useAccentTheme } from '../useAccentTheme'

describe('useAccentTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    useAccentTheme().setAccent('red')
  })

  it('setAccent aplica las variables del tema sobre <html> y lo guarda', () => {
    useAccentTheme().setAccent('green')

    const root = document.documentElement
    expect(root.style.getPropertyValue('--accent-rgb')).toBe('16, 185, 129')
    expect(root.style.getPropertyValue('--accent-contrast')).toBe('#03140c')
    expect(localStorage.getItem('berry_accent_color')).toBe('green')
    expect(useAccentTheme().palette.value.label).toBe('Verde')
  })

  it('initAccentTheme aplica el color actual sin animar', () => {
    useAccentTheme().setAccent('pink')
    document.documentElement.removeAttribute('style')
    document.documentElement.classList.remove('accent-transition')

    initAccentTheme()

    expect(document.documentElement.style.getPropertyValue('--accent-rgb')).toBe('236, 72, 153')
    expect(document.documentElement.classList.contains('accent-transition')).toBe(false)
  })
})
