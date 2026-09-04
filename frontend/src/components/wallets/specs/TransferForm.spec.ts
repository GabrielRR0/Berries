import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TransferEditTarget } from '../../../services/wallets/interfaces/wallets.interface'
import { useWalletsStore } from '../../../stores/wallets.store'
import TransferForm from '../TransferForm.vue'

const WALLET_CASH = { id: 'wallet-1', name: 'Cash', currency: 'USD', balance: 100, createdAt: '2026-01-01T00:00:00Z' }
const WALLET_BANK = { id: 'wallet-2', name: 'Banco', currency: 'USD', balance: 0, createdAt: '2026-01-01T00:00:00Z' }
const WALLET_VEF = { id: 'wallet-3', name: 'Binance', currency: 'VEF', balance: 0, createdAt: '2026-01-01T00:00:00Z' }

function mountForm(props: { editingTransfer?: TransferEditTarget | null } = {}) {
  return mount(TransferForm, { props })
}

describe('TransferForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useWalletsStore().wallets = [WALLET_CASH, WALLET_BANK, WALLET_VEF]
    vi.spyOn(useWalletsStore(), 'transfer').mockResolvedValue(undefined)
    vi.spyOn(useWalletsStore(), 'updateTransfer').mockResolvedValue(undefined)
  })

  it('el campo de fecha arranca en el dia de hoy, con max=hoy', () => {
    const wrapper = mountForm()

    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const dateInput = wrapper.find('input[type="date"]')
    expect((dateInput.element as HTMLInputElement).value).toBe(expected)
    expect(dateInput.attributes('max')).toBe(expected)
  })

  it('pide el monto convertido solo cuando las billeteras tienen moneda distinta', async () => {
    const wrapper = mountForm()

    await wrapper.find('select').setValue('wallet-1')
    await wrapper.findAll('select')[1]!.setValue('wallet-2')
    expect(wrapper.text()).not.toContain('Monto convertido')

    await wrapper.findAll('select')[1]!.setValue('wallet-3')
    expect(wrapper.text()).toContain('Monto convertido')
  })

  it('crear: llama a walletsStore.transfer con la fecha elegida', async () => {
    const wrapper = mountForm()

    await wrapper.find('select').setValue('wallet-1')
    await wrapper.findAll('select')[1]!.setValue('wallet-2')
    await wrapper.find('input[type="number"]').setValue(40)
    await wrapper.find('input[type="date"]').setValue('2026-01-15')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const [params] = vi.mocked(useWalletsStore().transfer).mock.calls[0]!
    expect(params.fromWalletId).toBe('wallet-1')
    expect(params.toWalletId).toBe('wallet-2')
    expect(params.amount).toBe(40)
    const sentDate = new Date(params.occurredAt!)
    expect(sentDate.getFullYear()).toBe(2026)
    expect(sentDate.getMonth()).toBe(0)
    expect(sentDate.getDate()).toBe(15)
    expect(wrapper.emitted('transferred')).toBeTruthy()
  })

  describe('modo edicion (editingTransfer)', () => {
    const EDITING: TransferEditTarget = {
      transferId: 'transfer-1',
      fromWalletId: 'wallet-1',
      toWalletId: 'wallet-2',
      amount: 40,
      fee: 2,
      convertedAmount: null,
      occurredAt: '2026-01-15T12:00:00Z',
    }

    it('precarga billeteras (deshabilitadas), monto, comision y fecha propia de la transferencia', () => {
      const wrapper = mountForm({ editingTransfer: EDITING })

      const selects = wrapper.findAll('select')
      expect((selects[0]!.element as HTMLSelectElement).value).toBe('wallet-1')
      expect((selects[1]!.element as HTMLSelectElement).value).toBe('wallet-2')
      expect(selects[0]!.attributes('disabled')).toBeDefined()
      expect(selects[1]!.attributes('disabled')).toBeDefined()

      const numberInputs = wrapper.findAll('input[type="number"]')
      expect((numberInputs[0]!.element as HTMLInputElement).valueAsNumber).toBe(40)
      expect((numberInputs[1]!.element as HTMLInputElement).valueAsNumber).toBe(2)

      expect((wrapper.find('input[type="date"]').element as HTMLInputElement).value).toBe('2026-01-15')
    })

    it('el titulo y el boton dicen "editar"', () => {
      const wrapper = mountForm({ editingTransfer: EDITING })

      expect(wrapper.find('.form-title').text()).toBe('Editar transferencia')
      expect(wrapper.find('button[type="submit"]').text()).toBe('Guardar cambios')
    })

    it('al guardar, llama a walletsStore.updateTransfer (no transfer) con el transferId y emite "updated"', async () => {
      const wrapper = mountForm({ editingTransfer: EDITING })

      await wrapper.findAll('input[type="number"]')[0]!.setValue(60)
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      expect(useWalletsStore().transfer).not.toHaveBeenCalled()
      const [transferId, params] = vi.mocked(useWalletsStore().updateTransfer).mock.calls[0]!
      expect(transferId).toBe('transfer-1')
      expect(params.amount).toBe(60)
      expect(params.fee).toBe(2)
      expect(wrapper.emitted('updated')).toBeTruthy()
      expect(wrapper.emitted('transferred')).toBeFalsy()
    })
  })
})
