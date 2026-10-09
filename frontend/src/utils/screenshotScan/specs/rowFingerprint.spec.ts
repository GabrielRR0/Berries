/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeRow } from '../movementRows'
import type { ScanRow } from '../movementRows'
import { hashFingerprint, importKeyFor, rowFingerprint } from '../rowFingerprint'

function bankRow(partial: Partial<ScanRow> = {}): ScanRow {
  return makeRow({
    source: 'bank',
    amount: 22848,
    direction: 'out',
    currency: 'VEF',
    occurredOn: '2026-10-08',
    time: '22:25',
    description: 'Operación pagomovil bdv',
    walletId: 'w-bs',
    ...partial,
  })
}

describe('rowFingerprint', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  })

  it('una fila de lista se identifica por billetera, sentido, monto, fecha, hora y texto', () => {
    expect(rowFingerprint(bankRow())).toBe('bank|w-bs|out|22848.00|2026-10-08|22:25|operacion pagomovil bdv')
  })

  it('cualquier dato distinto da otra huella', () => {
    const base = rowFingerprint(bankRow())

    expect(rowFingerprint(bankRow({ amount: 22849 }))).not.toBe(base)
    expect(rowFingerprint(bankRow({ time: '22:26' }))).not.toBe(base)
    expect(rowFingerprint(bankRow({ walletId: 'w-otra' }))).not.toBe(base)
    expect(rowFingerprint(bankRow({ direction: 'in' }))).not.toBe(base)
  })

  it('ignora tildes, mayusculas y espacios de mas en la descripcion (el OCR no es exacto)', () => {
    expect(rowFingerprint(bankRow({ description: '  OPERACION   PagoMovil BDV ' }))).toBe(rowFingerprint(bankRow()))
  })

  it('sin fecha no hay huella', () => {
    expect(rowFingerprint(bankRow({ occurredOn: null }))).toBeNull()
  })

  it('una orden P2P se identifica por su numero de orden, igual desde la orden y desde el abono enlazado', () => {
    const orderNumber = '22941692196588679168'
    const order = makeRow({
      source: 'p2p_order',
      amount: 26600,
      direction: 'in',
      p2p: { usdt: 26.48, price: 1006.5, orderNumber, counterparty: 'Nelasurej' },
    })
    const linkedDeposit = bankRow({ amount: 26600, direction: 'in', linkedOrderNumber: orderNumber })

    expect(rowFingerprint(order)).toBe(`p2p|${orderNumber}`)
    expect(rowFingerprint(linkedDeposit)).toBe(`p2p|${orderNumber}`)
  })

  it('un comprobante suelto se identifica por su numero de operacion', () => {
    const receipt = bankRow({ reference: '007608296806', occurredOn: null })

    expect(rowFingerprint(receipt)).toBe('ref|VEF|007608296806|out')
  })

  it('el hash es SHA-256 en hexadecimal y estable', async () => {
    const hash = await hashFingerprint('abc')

    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await importKeyFor(bankRow())).toBe(await importKeyFor(bankRow()))
  })

  it('sin crypto.subtle no hay huella y el registro sigue sin deteccion de duplicados', async () => {
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true })

    expect(await importKeyFor(bankRow())).toBeNull()
  })
})
