import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadScanBankPreference, saveScanBankPreference } from '../scanBankPreferenceStorage'

describe('scanBankPreferenceStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sin nada guardado devuelve el banco por defecto (Banco de Venezuela)', () => {
    expect(loadScanBankPreference()).toBe('bdv')
  })

  it('guarda la eleccion y la vuelve a leer', () => {
    saveScanBankPreference('bdv')

    expect(localStorage.getItem('berry_scan_bank')).toBe('bdv')
    expect(loadScanBankPreference()).toBe('bdv')
  })

  it('un valor guardado que ya no existe cae en el banco por defecto', () => {
    localStorage.setItem('berry_scan_bank', 'un-banco-que-se-quito')

    expect(loadScanBankPreference()).toBe('bdv')
  })

  it('si el storage falla (modo privado) no rompe: lee el de por defecto y guardar no lanza error', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })

    expect(loadScanBankPreference()).toBe('bdv')
    expect(() => saveScanBankPreference('bdv')).not.toThrow()
  })
})
