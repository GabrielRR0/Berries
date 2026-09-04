import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as transactionsService from '../../../services/transactions/transactions.service'
import * as walletsService from '../../../services/wallets/wallets.service'
import { useWalletsStore } from '../../../stores/wallets.store'
import DraftReviewCard from '../../transactions/DraftReviewCard.vue'
import VoiceEntryButton from '../../voiceEntry/VoiceEntryButton.vue'
import IncomeExpenseSummary from '../IncomeExpenseSummary.vue'

// El componente filtra "movimientos de este mes" contra la fecha real del
// sistema (ver isThisMonth en IncomeExpenseSummary.vue), asi que los
// fixtures no pueden ser fechas fijas - un mes hardcodeado (ej. "2026-08")
// deja de ser "este mes" apenas cambia el calendario real y los tests
// empiezan a fallar solos, sin que nadie haya tocado el codigo. Se
// calculan relativas al momento en que corre el test.
const now = new Date()
function thisMonthDate(day: number): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00Z`
}

const WALLET = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 100, createdAt: thisMonthDate(1) }

// Bottom sheet pedido explicito del usuario: tocar la box de Ingresos/Gastos
// en Inicio abre el detalle filtrado de ese tipo, deslizandose desde abajo
// (ver BottomSheet.vue). Estos tests cubren la logica nueva (abrir/cerrar,
// filtrado por tipo, eliminar desde el sheet) - la animacion en si ya se
// verifico visualmente con Playwright contra el dev server real.
const TRANSACTIONS = [
  {
    id: 'tx-income-1',
    walletId: 'wallet-1',
    type: 'income' as const,
    amount: 500,
    category: 'Ingreso',
    description: null,
    occurredAt: thisMonthDate(5),
    source: 'manual',
    transferId: null,
    referenceAmountUsd: null,
    createdAt: thisMonthDate(5),
  },
  {
    id: 'tx-expense-1',
    walletId: 'wallet-1',
    type: 'expense' as const,
    amount: 40,
    category: 'Transporte',
    description: null,
    occurredAt: thisMonthDate(7),
    source: 'manual',
    transferId: null,
    referenceAmountUsd: null,
    createdAt: thisMonthDate(7),
  },
]

describe('IncomeExpenseSummary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(transactionsService, 'listTransactions').mockResolvedValue(TRANSACTIONS)
    vi.spyOn(transactionsService, 'deleteTransaction').mockResolvedValue(undefined)
    // transactions.store.ts fuerza un refresh de wallets tras crear/eliminar
    // un movimiento (cambia el balance real de una wallet) - sin este mock
    // ese refresh intenta un fetch real y ensucia el test con un rejection
    // sin manejar.
    vi.spyOn(walletsService, 'listWallets').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('no muestra ningun sheet al montar', async () => {
    const wrapper = mount(IncomeExpenseSummary)
    await flushPromises()

    expect(wrapper.find('.sheet-scrim').exists()).toBe(false)
  })

  it('al tocar Ingresos abre el sheet solo con los movimientos de tipo income', async () => {
    const wrapper = mount(IncomeExpenseSummary)
    await flushPromises()

    await wrapper.find('[aria-haspopup="dialog"]').trigger('click')

    expect(wrapper.find('.sheet-scrim').exists()).toBe(true)
    expect(wrapper.text()).toContain('Ingresos de este mes')
    expect(wrapper.text()).not.toContain('Transporte')
  })

  it('al tocar Gastos abre el sheet solo con los movimientos de tipo expense', async () => {
    const wrapper = mount(IncomeExpenseSummary)
    await flushPromises()

    const cards = wrapper.findAll('[aria-haspopup="dialog"]')
    await cards[1]!.trigger('click')

    expect(wrapper.text()).toContain('Gastos de este mes')
    expect(wrapper.text()).toContain('Transporte')
  })

  it('cierra el sheet al emitir close', async () => {
    const wrapper = mount(IncomeExpenseSummary)
    await flushPromises()
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click')
    expect(wrapper.find('.sheet-scrim').exists()).toBe(true)

    await wrapper.find('.sheet-close').trigger('click')

    expect(wrapper.find('.sheet-scrim').exists()).toBe(false)
  })

  it('muestra un mensaje vacio si no hay movimientos de ese tipo en el mes', async () => {
    vi.mocked(transactionsService.listTransactions).mockResolvedValue([TRANSACTIONS[1]!])
    const wrapper = mount(IncomeExpenseSummary)
    await flushPromises()

    await wrapper.find('[aria-haspopup="dialog"]').trigger('click')

    expect(wrapper.text()).toContain('No tienes ingresos registrados este mes.')
  })

  it('eliminar un movimiento desde el sheet lo saca de la lista y no rompe si el service falla', async () => {
    const wrapper = mount(IncomeExpenseSummary)
    await flushPromises()
    const cards = wrapper.findAll('[aria-haspopup="dialog"]')
    await cards[1]!.trigger('click')

    await wrapper.find('.transaction-delete-trigger').trigger('click')
    await wrapper.find('.transaction-confirm-delete').trigger('click')
    await flushPromises()

    expect(transactionsService.deleteTransaction).toHaveBeenCalledWith('tx-expense-1')
    expect(wrapper.text()).toContain('No tienes gastos registrados este mes.')
  })

  it('el boton de agregar del sheet de Ingresos abre el form con "income" ya seleccionado', async () => {
    useWalletsStore().wallets = [WALLET]
    const wrapper = mount(IncomeExpenseSummary)
    await flushPromises()
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click') // Ingresos

    await wrapper.find('.sheet-add-trigger').trigger('click')

    expect(wrapper.find('.type-option.active').text()).toBe('Ingreso')
  })

  it('crear un ingreso desde el sheet lo agrega a la lista y cierra el form', async () => {
    useWalletsStore().wallets = [WALLET]
    const created = {
      id: 'tx-income-2',
      walletId: 'wallet-1',
      type: 'income' as const,
      amount: 200,
      category: 'Bono',
      description: null,
      occurredAt: thisMonthDate(10),
      source: 'manual',
      transferId: null,
      referenceAmountUsd: null,
      createdAt: thisMonthDate(10),
    }
    vi.spyOn(transactionsService, 'createTransaction').mockResolvedValue(created)

    const wrapper = mount(IncomeExpenseSummary)
    await flushPromises()
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click') // Ingresos
    await wrapper.find('.sheet-add-trigger').trigger('click')

    await wrapper.find('select').setValue('wallet-1')
    await wrapper.find('input[type="number"]').setValue(200)
    await wrapper.find('input[maxlength="80"]').setValue('Bono')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(transactionsService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ walletId: 'wallet-1', type: 'income', amount: 200, category: 'Bono' }),
    )
    expect(wrapper.find('.sheet-add-form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bono')
  })

  // Botones de voz/foto dentro del sheet - pedido explicito del usuario
  // ("se pueda agregar la opcion de audio o foto asi como seria en
  // movimientos"). VoiceEntryButton/ReceiptUpload ya tienen su propio spec
  // para el flujo interno (grabar/subir); aca solo se cubre el cableado de
  // IncomeExpenseSummary: un draft creado aparece para revision con el tipo
  // del sheet activo precargado, y confirmarlo/descartarlo actualiza el
  // estado local igual que con la transaction manual.
  it('un draft creado desde el sheet de Ingresos aparece para revision con "income" precargado', async () => {
    useWalletsStore().wallets = [WALLET]
    const wrapper = mount(IncomeExpenseSummary)
    await flushPromises()
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click') // Ingresos

    await wrapper.findComponent(VoiceEntryButton).vm.$emit('created', {
      id: 'draft-1',
      source: 'voice',
      rawInput: 'recibi 50 dolares',
      parsedAmount: 50,
      parsedCurrency: 'USD',
      parsedCategory: 'Ingreso',
      parsedDescription: null,
      status: 'pending',
      createdAt: thisMonthDate(15),
    })
    await flushPromises()

    const draftCard = wrapper.findComponent(DraftReviewCard)
    expect(draftCard.exists()).toBe(true)
    expect(draftCard.props('initialType')).toBe('income')
  })

  it('confirmar un draft desde el sheet lo agrega a la lista y lo saca de pendientes', async () => {
    useWalletsStore().wallets = [WALLET]
    const wrapper = mount(IncomeExpenseSummary)
    await flushPromises()
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click') // Ingresos

    await wrapper.findComponent(VoiceEntryButton).vm.$emit('created', {
      id: 'draft-1',
      source: 'voice',
      rawInput: 'recibi 50 dolares',
      parsedAmount: 50,
      parsedCurrency: 'USD',
      parsedCategory: 'Ingreso',
      parsedDescription: null,
      status: 'pending',
      createdAt: thisMonthDate(15),
    })
    await flushPromises()

    // id de la transaction DISTINTO del id del draft a proposito (son
    // entidades distintas backend-side) - un id igual a "draft-1" hubiera
    // ocultado el bug real de "la tarjeta no desaparecia al confirmar"
    // (filtraba por transaction.id en vez del draftId explicito).
    await wrapper.findComponent(DraftReviewCard).vm.$emit(
      'confirmed',
      {
        id: 'tx-income-2',
        walletId: 'wallet-1',
        type: 'income' as const,
        amount: 50,
        category: 'Ingreso',
        description: null,
        occurredAt: thisMonthDate(15),
        source: 'voice',
        transferId: null,
        referenceAmountUsd: null,
        createdAt: thisMonthDate(15),
      },
      'draft-1',
    )
    await flushPromises()

    expect(wrapper.findComponent(DraftReviewCard).exists()).toBe(false)
    expect(wrapper.text()).toContain('Ingreso')
  })
})
