import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recognizeScreenshot } from '../../../services/screenshotScan/screenshot-scan.service'
import { createDraftsBulk, createTransactionsBulk } from '../../../services/transactions/transactions.service'
import { useTransactionsStore } from '../../../stores/transactions.store'
import { useWalletsStore } from '../../../stores/wallets.store'
import { BANK_WORDS, P2P_WORDS, isGreen, layoutOf } from '../../../utils/screenshotScan/specs/listFixtures'
import { useBulkCapture } from '../useBulkCapture'

vi.mock('../../../services/screenshotScan/screenshot-scan.service', () => ({ recognizeScreenshot: vi.fn() }))
vi.mock('../../../services/transactions/transactions.service', () => ({
  createTransactionsBulk: vi.fn(),
  createDraftsBulk: vi.fn(),
}))

const USDT = { id: 'w-usdt', name: 'Binance', currency: 'USDT', balance: 200, createdAt: '2026-01-01T00:00:00Z' }
const BS = { id: 'w-bs', name: 'BDV', currency: 'VEF', balance: 90000, createdAt: '2026-01-01T00:00:00Z' }

const bankLayout = layoutOf(BANK_WORDS, 924, isGreen)
const p2pLayout = layoutOf(P2P_WORDS, 1170)

function image(name = 'captura.png'): File {
  return new File(['x'], name, { type: 'image/png' })
}

describe('useBulkCapture', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Hoy = 9 de octubre de 2026: "AYER" es el 8 y las ordenes P2P "10-08" son de este año.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0, 0))
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()

    const wallets = useWalletsStore()
    wallets.wallets = [USDT, BS]
    vi.spyOn(wallets, 'transfer').mockResolvedValue(undefined)
    vi.spyOn(wallets, 'fetchWallets').mockResolvedValue(undefined)
    vi.spyOn(useTransactionsStore(), 'fetchTransactions').mockResolvedValue(undefined)

    vi.mocked(recognizeScreenshot).mockReset()
    vi.mocked(createTransactionsBulk).mockReset().mockResolvedValue([])
    vi.mocked(createDraftsBulk).mockReset().mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lee una lista del banco y asigna la billetera elegida a cada fila', async () => {
    vi.mocked(recognizeScreenshot).mockResolvedValue(bankLayout)
    const capture = useBulkCapture(BS.id)

    await capture.addImages([image()])

    expect(capture.images.value[0]).toMatchObject({ status: 'done', kind: 'bank_list', rowCount: 5 })
    expect(capture.visibleRows.value).toHaveLength(5)
    expect(capture.visibleRows.value.every((row) => row.walletId === BS.id)).toBe(true)
    expect(capture.visibleRows.value.every((row) => row.occurredOn === '2026-10-08')).toBe(true)
  })

  it('no deja confirmar mientras falten categorias, y avisa cuales filas faltan', async () => {
    vi.mocked(recognizeScreenshot).mockResolvedValue(bankLayout)
    const capture = useBulkCapture(BS.id)
    await capture.addImages([image()])

    expect(capture.canConfirm.value).toBe(false)
    const withoutCategory = capture.blockedRows.value.map((row) => row.amount)
    // Gastos sin categoria y recibidos sin categoria (22.848, 26.600, 9.000, 10.000, 10.500).
    expect(withoutCategory).toEqual(expect.arrayContaining([22848, 9000, 10500]))
  })

  it('enlaza los recibidos con las ordenes P2P de otra captura y completa los USDT', async () => {
    vi.mocked(recognizeScreenshot).mockResolvedValueOnce(bankLayout).mockResolvedValueOnce(p2pLayout)
    const capture = useBulkCapture(BS.id)

    await capture.addImages([image('banco.png'), image('binance.png')])

    const received = capture.visibleRows.value.find((row) => row.amount === 26600)!
    expect(received).toMatchObject({
      action: 'transfer',
      sentAmount: 26.48,
      fromWalletId: USDT.id,
      toWalletId: BS.id,
    })
    // Las ordenes ya enlazadas no se muestran; solo queda la tercera, sin pareja y omitida.
    const orders = capture.visibleRows.value.filter((row) => row.source === 'p2p_order')
    expect(orders).toHaveLength(1)
    expect(orders[0]!.action).toBe('skip')
  })

  it('registra gastos con su comision, transferencias y deja fuera lo omitido', async () => {
    vi.mocked(recognizeScreenshot).mockResolvedValueOnce(bankLayout).mockResolvedValueOnce(p2pLayout)
    const capture = useBulkCapture(BS.id)
    await capture.addImages([image('banco.png'), image('binance.png')])

    for (const row of capture.visibleRows.value.filter((item) => item.action === 'expense')) {
      capture.updateRow(row.id, { category: 'Mercado' })
    }
    expect(capture.canConfirm.value).toBe(true)

    const outcome = await capture.confirm()

    expect(outcome).toMatchObject({ registered: 3, transfers: 2, pendings: 0, skipped: 1, failures: [] })
    const [items] = vi.mocked(createTransactionsBulk).mock.calls[0]!
    // 3 gastos + sus 3 comisiones (68,54 + 27,00 + 31,50) como gastos "Comisión".
    expect(items).toHaveLength(6)
    expect(items.filter((item) => item.category === 'Comisión').map((item) => item.amount)).toEqual([68.54, 27, 31.5])

    const transfers = vi.mocked(useWalletsStore().transfer).mock.calls.map(([params]) => params)
    expect(transfers).toHaveLength(2)
    expect(transfers[0]).toMatchObject({ fromWalletId: USDT.id, toWalletId: BS.id, amount: 26.48, convertedAmount: 26600 })
    // Lo registrado sale de la lista: reintentar no lo duplica.
    expect(capture.visibleRows.value.filter((row) => row.action !== 'skip')).toHaveLength(0)
  })

  it('un recibido que el usuario deja pendiente se guarda como borrador en el servidor', async () => {
    vi.mocked(recognizeScreenshot).mockResolvedValue(bankLayout)
    const capture = useBulkCapture(BS.id)
    await capture.addImages([image()])

    for (const row of capture.visibleRows.value) {
      if (row.direction === 'out') capture.updateRow(row.id, { category: 'Mercado' })
      else capture.setAction(row.id, 'pending')
    }

    const outcome = await capture.confirm()

    expect(outcome.pendings).toBe(2)
    const [drafts] = vi.mocked(createDraftsBulk).mock.calls[0]!
    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({ parsedCurrency: 'VEF', txnType: 'income', suggestedWalletId: BS.id })
  })

  it('si el lote de gastos falla, no se crea nada mas y se informa el error', async () => {
    vi.mocked(recognizeScreenshot).mockResolvedValue(bankLayout)
    vi.mocked(createTransactionsBulk).mockRejectedValue(new Error('Billetera no encontrada'))
    const capture = useBulkCapture(BS.id)
    await capture.addImages([image()])
    for (const row of capture.visibleRows.value) capture.updateRow(row.id, { category: 'Mercado' })

    const outcome = await capture.confirm()

    expect(outcome.failures).toEqual([{ label: 'Gastos e ingresos', message: 'Billetera no encontrada' }])
    expect(createDraftsBulk).not.toHaveBeenCalled()
    expect(useWalletsStore().transfer).not.toHaveBeenCalled()
    expect(capture.visibleRows.value).toHaveLength(5)
  })

  it('una transferencia que falla no impide las demas y su fila se conserva para reintentar', async () => {
    vi.mocked(recognizeScreenshot).mockResolvedValueOnce(bankLayout).mockResolvedValueOnce(p2pLayout)
    vi.mocked(useWalletsStore().transfer)
      .mockRejectedValueOnce(new Error('Saldo insuficiente para esta transferencia'))
      .mockResolvedValueOnce(undefined)
    const capture = useBulkCapture(BS.id)
    await capture.addImages([image('banco.png'), image('binance.png')])
    for (const row of capture.visibleRows.value.filter((item) => item.action === 'expense')) {
      capture.updateRow(row.id, { category: 'Mercado' })
    }

    const outcome = await capture.confirm()

    expect(outcome.transfers).toBe(1)
    expect(outcome.failures).toHaveLength(1)
    expect(outcome.failures[0]!.message).toBe('Saldo insuficiente para esta transferencia')
    expect(capture.visibleRows.value.filter((row) => row.action === 'transfer')).toHaveLength(1)
  })

  it('una captura que no se reconoce queda marcada con error y no agrega filas', async () => {
    vi.mocked(recognizeScreenshot).mockResolvedValue(layoutOf([], 924))
    const capture = useBulkCapture(BS.id)

    await capture.addImages([image()])

    expect(capture.images.value[0]!.status).toBe('error')
    expect(capture.visibleRows.value).toHaveLength(0)
  })

  it('un archivo que no es imagen se rechaza sin leerlo', async () => {
    const capture = useBulkCapture(BS.id)

    await capture.addImages([new File(['x'], 'nota.txt', { type: 'text/plain' })])

    expect(recognizeScreenshot).not.toHaveBeenCalled()
    expect(capture.images.value[0]!.message).toContain('no es una imagen')
  })
})
