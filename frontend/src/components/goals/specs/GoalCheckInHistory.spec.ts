import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as goalsService from '../../../services/goals/goals.service'
import type { GoalCheckIn } from '../../../services/goals/interfaces/goals.interface'
import GoalCheckInHistory from '../GoalCheckInHistory.vue'

const WALLET = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 1000, createdAt: '2026-01-01T00:00:00Z' }

const FUTURE_CHECK_IN: GoalCheckIn = {
  id: 'ci-1',
  goalId: 'goal-1',
  periodMonth: '2026-09-01',
  amountSaved: 50,
  previousTargetDate: null,
  newTargetDate: null,
  note: 'venta de la laptop',
  walletId: null,
  createdAt: '2026-09-01T00:00:00Z',
}

const LINKED_CHECK_IN: GoalCheckIn = {
  ...FUTURE_CHECK_IN,
  id: 'ci-2',
  walletId: 'wallet-1',
  note: null,
}

// mountAttached: el sheet de edicion se teletransporta a <body> (Teleport, ver
// GoalCheckInHistory.vue) - mismo patron ya establecido en GoalCard.spec.ts.
const mountedWrappers: ReturnType<typeof mount>[] = []
function mountHistory(props: Record<string, unknown> = {}) {
  const wrapper = mount(GoalCheckInHistory, {
    props: { goalId: 'goal-1', currency: 'USD', wallets: [WALLET], walletCommitments: {}, ...props },
    attachTo: document.body,
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

function inBody(selector: string) {
  return new DOMWrapper(document.body).find(selector)
}

describe('GoalCheckInHistory', () => {
  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount()
    vi.restoreAllMocks()
  })

  it('muestra "Ingreso futuro" y la nota para un aporte sin billetera enlazada', async () => {
    vi.spyOn(goalsService, 'listCheckIns').mockResolvedValue([FUTURE_CHECK_IN])
    const wrapper = mountHistory()
    await flushPromises()

    expect(wrapper.find('.check-in-history-source').text()).toContain('Ingreso futuro')
    expect(wrapper.find('.check-in-history-source').text()).toContain('venta de la laptop')
  })

  it('muestra el nombre de la billetera para un aporte ya enlazado', async () => {
    vi.spyOn(goalsService, 'listCheckIns').mockResolvedValue([LINKED_CHECK_IN])
    const wrapper = mountHistory()
    await flushPromises()

    expect(wrapper.find('.check-in-history-source').text()).toContain('Desde: Efectivo')
  })

  // Pedido explicito del usuario: "yo quiero ir a metas y en ese aporte editarlo y
  // decir que los voy a usar de mi billetera".
  it('tocar "Editar" abre el sheet de edicion precargado con ese aporte', async () => {
    vi.spyOn(goalsService, 'listCheckIns').mockResolvedValue([FUTURE_CHECK_IN])
    const wrapper = mountHistory()
    await flushPromises()

    await wrapper.find('.check-in-history-edit').trigger('click')

    expect(inBody('.check-in-edit-sheet').exists()).toBe(true)
    expect((inBody('input[type="text"]').element as HTMLInputElement).value).toBe('venta de la laptop')
  })

  it('guardar en el sheet llama a updateCheckIn, refresca la fila y emite "checkInEdited"', async () => {
    vi.spyOn(goalsService, 'listCheckIns').mockResolvedValue([FUTURE_CHECK_IN])
    const updated = { ...FUTURE_CHECK_IN, walletId: 'wallet-1', note: null }
    vi.spyOn(goalsService, 'updateCheckIn').mockResolvedValue(updated)
    const wrapper = mountHistory()
    await flushPromises()

    await wrapper.find('.check-in-history-edit').trigger('click')
    const billeteraPill = new DOMWrapper(document.body).findAll('.pill').find((btn) => btn.text() === 'Billetera')!
    await billeteraPill.trigger('click')
    await inBody('select').setValue('wallet-1')
    const saveButton = new DOMWrapper(document.body).findAll('button').find((btn) => btn.text() === 'Guardar cambios')!
    await saveButton.trigger('click')
    await flushPromises()

    expect(goalsService.updateCheckIn).toHaveBeenCalledWith('goal-1', 'ci-1', { walletId: 'wallet-1', note: null })
    expect(wrapper.emitted('checkInEdited')).toBeTruthy()
    expect(inBody('.check-in-edit-sheet').exists()).toBe(false)
    expect(wrapper.find('.check-in-history-source').text()).toContain('Desde: Efectivo')
  })

  it('un error al guardar muestra el mensaje sin cerrar el sheet', async () => {
    vi.spyOn(goalsService, 'listCheckIns').mockResolvedValue([FUTURE_CHECK_IN])
    vi.spyOn(goalsService, 'updateCheckIn').mockRejectedValue(new Error('Saldo insuficiente.'))
    const wrapper = mountHistory()
    await flushPromises()

    await wrapper.find('.check-in-history-edit').trigger('click')
    const billeteraPill = new DOMWrapper(document.body).findAll('.pill').find((btn) => btn.text() === 'Billetera')!
    await billeteraPill.trigger('click')
    await inBody('select').setValue('wallet-1')
    const saveButton = new DOMWrapper(document.body).findAll('button').find((btn) => btn.text() === 'Guardar cambios')!
    await saveButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Saldo insuficiente.')
    expect(inBody('.check-in-edit-sheet').exists()).toBe(true)
  })
})
