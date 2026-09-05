import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { PendingCheckIn } from '../../../services/goals/interfaces/goals.interface'
import GoalCheckInPrompt from '../GoalCheckInPrompt.vue'

const PENDING: PendingCheckIn = {
  goalId: 'goal-1',
  title: 'TV',
  currency: 'USD',
  targetDate: '2026-11-28',
  suggestedAmount: 80,
}

const WALLET_USD = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 1000, createdAt: '2026-01-01T00:00:00Z' }
const WALLET_EUR = { id: 'wallet-2', name: 'Banco EUR', currency: 'EUR', balance: 500, createdAt: '2026-01-01T00:00:00Z' }

function mountPrompt(props: Record<string, unknown> = {}) {
  return mount(GoalCheckInPrompt, { props: { pending: PENDING, wallets: [], walletCommitments: {}, ...props } })
}

describe('GoalCheckInPrompt', () => {
  it('registrar sin tocar nada emite solo amountSaved (sin billetera, ingreso futuro por defecto)', async () => {
    const wrapper = mountPrompt()

    await wrapper.find('.check-in-register').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([[{ amountSaved: 80, walletId: undefined, note: undefined }]])
  })

  // Pedido explicito del usuario: enlazar tambien un aporte del chequeo mensual a una
  // billetera.
  describe('fuente del aporte (billetera vs. ingreso futuro)', () => {
    async function chooseWalletSource(wrapper: ReturnType<typeof mount>) {
      await wrapper.findAll('.pill').find((btn) => btn.text() === 'Billetera')!.trigger('click')
    }

    it('el selector solo ofrece billeteras de la misma moneda que la meta', async () => {
      const wrapper = mountPrompt({ wallets: [WALLET_USD, WALLET_EUR] })
      await chooseWalletSource(wrapper)

      const options = wrapper.find('.check-in-wallet-field select').findAll('option').map((o) => o.text())
      expect(options.some((text) => text.includes('Efectivo'))).toBe(true)
      expect(options.some((text) => text.includes('Banco EUR'))).toBe(false)
    })

    it('registrar con una billetera elegida emite el walletId', async () => {
      const wrapper = mountPrompt({ wallets: [WALLET_USD] })
      await chooseWalletSource(wrapper)
      await wrapper.find('.check-in-wallet-field select').setValue('wallet-1')

      await wrapper.find('.check-in-register').trigger('click')

      expect(wrapper.emitted('submit')).toEqual([[{ amountSaved: 80, walletId: 'wallet-1', note: undefined }]])
    })

    it('bloquea "Registrar" si el monto supera el disponible de la billetera elegida', async () => {
      const wrapper = mountPrompt({ wallets: [WALLET_USD], walletCommitments: { 'wallet-1': 950 } }) // disponible: 50
      await chooseWalletSource(wrapper)
      await wrapper.find('.check-in-wallet-field select').setValue('wallet-1')

      expect(wrapper.find('.check-in-register').attributes('disabled')).toBeDefined()
      expect(wrapper.find('.check-in-wallet-hint.warning').exists()).toBe(true)
      await wrapper.find('.check-in-register').trigger('click')
      expect(wrapper.emitted('submit')).toBeFalsy()
    })

    it('con "Ingreso futuro" se puede escribir una nota de donde sale', async () => {
      const wrapper = mountPrompt()

      await wrapper.find('.check-in-source-note').setValue('venta de la laptop')
      await wrapper.find('.check-in-register').trigger('click')

      expect(wrapper.emitted('submit')).toEqual([
        [{ amountSaved: 80, walletId: undefined, note: 'venta de la laptop' }],
      ])
    })
  })

  describe('posponer', () => {
    it('tambien incluye la billetera elegida al posponer', async () => {
      const wrapper = mountPrompt({ wallets: [WALLET_USD] })
      await wrapper.findAll('.pill').find((btn) => btn.text() === 'Billetera')!.trigger('click')
      await wrapper.find('.check-in-wallet-field select').setValue('wallet-1')

      await wrapper.find('.check-in-postpone-trigger').trigger('click')
      await wrapper.find('input[type="date"]').setValue('2026-12-28')
      await wrapper.findAll('.check-in-register').at(-1)!.trigger('click')

      expect(wrapper.emitted('submit')).toEqual([
        [{ amountSaved: 80, newTargetDate: '2026-12-28', note: undefined, walletId: 'wallet-1' }],
      ])
    })
  })
})
