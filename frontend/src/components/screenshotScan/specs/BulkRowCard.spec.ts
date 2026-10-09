import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rowIssues } from '../../../utils/screenshotScan/confirmPlan'
import { makeRow } from '../../../utils/screenshotScan/movementRows'
import type { ScanRow } from '../../../utils/screenshotScan/movementRows'
import BulkRowCard from '../BulkRowCard.vue'

vi.mock('../../../services/categories/categories.service', () => ({
  listCategories: vi.fn().mockResolvedValue([]),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  hideCategory: vi.fn(),
  unhideCategory: vi.fn(),
  CategoriesApiError: class CategoriesApiError extends Error {},
}))

const USDT = { id: 'w-usdt', name: 'Binance', currency: 'USDT', balance: 100, createdAt: '2026-01-01T00:00:00Z' }
const BS = { id: 'w-bs', name: 'BDV', currency: 'VEF', balance: 0, createdAt: '2026-01-01T00:00:00Z' }

// Orden P2P ya leida: se propone como transferencia con los 26,48 USDT conocidos.
function p2pOrder(partial: Partial<ScanRow> = {}): ScanRow {
  return makeRow({
    source: 'p2p_order',
    amount: 26600,
    currency: 'VEF',
    direction: 'in',
    occurredOn: '2026-10-08',
    time: '21:55',
    description: 'Binance P2P · Nelasurej',
    action: 'transfer',
    sentAmount: 26.48,
    fromWalletId: USDT.id,
    toWalletId: BS.id,
    p2p: { usdt: 26.48, price: 1006.513, orderNumber: '22941692196588679168', counterparty: 'Nelasurej' },
    ...partial,
  })
}

function mountCard(row: ScanRow) {
  return mount(BulkRowCard, { props: { row, issues: rowIssues(row), wallets: [USDT, BS] } })
}

describe('BulkRowCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('una orden P2P como transferencia ya trae los USDT: no pide "cuanto salio del origen"', () => {
    const wrapper = mountCard(p2pOrder())

    expect(wrapper.text()).toContain('Orden P2P: 26.48 USDT')
    expect(wrapper.text()).not.toContain('Falta')
    expect(wrapper.find('.row-issues').exists()).toBe(false)
  })

  it('cuando todo esta completo el boton es discreto ("Editar") y abre el editor', async () => {
    const wrapper = mountCard(p2pOrder())
    const button = wrapper.find('.edit-toggle')

    expect(button.text()).toContain('Editar')
    expect(button.classes()).toContain('edit-toggle--quiet')

    await button.trigger('click')
    expect(wrapper.find('.row-editor').exists()).toBe(true)
    expect(wrapper.text()).toContain('Cuánto salió del origen')
  })

  it('cuando falta algo, el boton lo dice y es el destacado', () => {
    const wrapper = mountCard(p2pOrder({ occurredOn: null }))

    expect(wrapper.find('.row-issues').text()).toContain('Falta la fecha')
    const button = wrapper.find('.edit-toggle')
    expect(button.text()).toContain('Completar los datos que faltan')
    expect(button.classes()).not.toContain('edit-toggle--quiet')
  })

  it('una fila omitida explica que no se registra y mantiene los botones activos', async () => {
    const wrapper = mountCard(p2pOrder({ action: 'skip' }))

    expect(wrapper.text()).toContain('No se registrará')
    // Atenua solo el contenido, no la tarjeta completa ni los botones de accion.
    expect(wrapper.classes()).toContain('row-card--skipped')
    const chips = wrapper.findAll('.action-chip')
    expect(chips.map((chip) => chip.text())).toEqual(['Transferencia', 'Omitir'])

    await chips[0]!.trigger('click')
    expect(wrapper.emitted('update')?.[0]).toEqual([{ action: 'transfer' }])
  })

  it('el editor de una transferencia deja corregir el monto enviado y emite el cambio', async () => {
    const wrapper = mountCard(p2pOrder())
    await wrapper.find('.edit-toggle').trigger('click')
    await flushPromises()

    await wrapper.find('input[placeholder="Si no lo sabes, déjalo pendiente"]').setValue('26.5')

    expect(wrapper.emitted('update')?.at(-1)).toEqual([{ sentAmount: 26.5 }])
  })
})
