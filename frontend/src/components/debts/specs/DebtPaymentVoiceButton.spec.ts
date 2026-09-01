import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseDebtPaymentVoice } from '../../../services/debts/debts.service'
import DebtPaymentVoiceButton from '../DebtPaymentVoiceButton.vue'

vi.mock('../../../services/debts/debts.service', () => ({
  parseDebtPaymentVoice: vi.fn(),
}))

// VoiceRecorderModal.vue depende de la Web Speech API del navegador (no
// disponible en jsdom) - se stubea con un componente minimo que expone el
// prop "submit" tal cual lo haria un transcript ya confirmado por el
// usuario, mismo criterio que el stub de GoogleSignInButton en
// RegisterWizard.spec.ts.
function mountButton(debtId = 'debt-1') {
  return mount(DebtPaymentVoiceButton, {
    props: { debtId },
    global: {
      stubs: {
        VoiceRecorderModal: {
          props: ['submit'],
          template: '<button class="voice-modal-stub" type="button" @click="onClick"></button>',
          methods: {
            async onClick() {
              const result = await (this as any).submit('ayer me pagaron 50 usdt')
              this.$emit('created', result)
            },
          },
        },
      },
    },
  })
}

describe('DebtPaymentVoiceButton', () => {
  beforeEach(() => {
    vi.mocked(parseDebtPaymentVoice).mockReset()
  })

  it('el modal de voz no se monta hasta tocar el trigger', () => {
    const wrapper = mountButton()

    expect(wrapper.find('.voice-modal-stub').exists()).toBe(false)
  })

  it('al tocar el trigger, abre el modal de voz', async () => {
    const wrapper = mountButton()

    await wrapper.find('.voice-trigger').trigger('click')

    expect(wrapper.find('.voice-modal-stub').exists()).toBe(true)
  })

  it('el submit del modal llama a parseDebtPaymentVoice con el debtId y el transcript', async () => {
    vi.mocked(parseDebtPaymentVoice).mockResolvedValue({
      amount: 50,
      currency: 'USDT',
      paidAt: '2026-08-30',
      note: 'ayer me pagaron 50 usdt',
    })
    const wrapper = mountButton('debt-42')

    await wrapper.find('.voice-trigger').trigger('click')
    await wrapper.find('.voice-modal-stub').trigger('click')

    expect(parseDebtPaymentVoice).toHaveBeenCalledWith('debt-42', 'ayer me pagaron 50 usdt')
  })

  it('emite "parsed" con el resultado y cierra el modal', async () => {
    const preview = { amount: 50, currency: 'USDT', paidAt: '2026-08-30', note: 'ayer me pagaron 50 usdt' }
    vi.mocked(parseDebtPaymentVoice).mockResolvedValue(preview)
    const wrapper = mountButton()

    await wrapper.find('.voice-trigger').trigger('click')
    await wrapper.find('.voice-modal-stub').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('parsed')).toEqual([[preview]])
    expect(wrapper.find('.voice-modal-stub').exists()).toBe(false)
  })
})
