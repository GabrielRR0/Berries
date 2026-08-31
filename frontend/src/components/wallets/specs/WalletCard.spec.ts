import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WalletCard from '../WalletCard.vue'

const WALLET = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 100, createdAt: '2026-08-01T00:00:00Z' }

describe('WalletCard', () => {
  it('muestra nombre y moneda de la wallet', () => {
    const wrapper = mount(WalletCard, { props: { wallet: WALLET } })

    expect(wrapper.text()).toContain('Efectivo')
    expect(wrapper.text()).toContain('USD')
  })

  it('muestra "¿Eliminar?" al pedir confirmacion', async () => {
    const wrapper = mount(WalletCard, { props: { wallet: WALLET } })

    await wrapper.find('.wallet-delete-trigger').trigger('click')

    expect(wrapper.find('.wallet-confirm-text').text()).toBe('¿Eliminar?')
  })

  it('cancelar vuelve al trigger sin emitir "delete"', async () => {
    const wrapper = mount(WalletCard, { props: { wallet: WALLET } })

    await wrapper.find('.wallet-delete-trigger').trigger('click')
    await wrapper.find('.wallet-confirm-cancel').trigger('click')

    expect(wrapper.find('.wallet-delete-trigger').exists()).toBe(true)
    expect(wrapper.emitted('delete')).toBeFalsy()
  })

  it('emite "delete" con el id al confirmar', async () => {
    const wrapper = mount(WalletCard, { props: { wallet: WALLET } })

    await wrapper.find('.wallet-delete-trigger').trigger('click')
    await wrapper.find('.wallet-confirm-delete').trigger('click')

    expect(wrapper.emitted('delete')).toEqual([['wallet-1']])
  })
})
