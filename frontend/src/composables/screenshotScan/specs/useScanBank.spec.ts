import { beforeEach, describe, expect, it } from 'vitest'
import { useScanBank } from '../useScanBank'

describe('useScanBank', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('arranca con Banco de Venezuela y ofrece solo los bancos que existen', () => {
    const { bankId, bankLabel, bankOptions } = useScanBank()

    expect(bankId.value).toBe('bdv')
    expect(bankLabel.value).toBe('Banco de Venezuela')
    expect(bankOptions.map((option) => option.id)).toEqual(['bdv'])
  })

  it('elegir el banco que ya estaba elegido no escribe nada (guardar la eleccion se prueba en el storage)', () => {
    localStorage.clear()

    useScanBank().setBank('bdv')

    expect(localStorage.getItem('berry_scan_bank')).toBeNull()
  })

  it('el estado es compartido entre quien lo use (pantalla, menu y captura)', () => {
    expect(useScanBank().bankId).toBe(useScanBank().bankId)
  })
})
