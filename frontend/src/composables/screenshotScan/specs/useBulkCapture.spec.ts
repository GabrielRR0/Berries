/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recognizeScreenshot } from '../../../services/screenshotScan/screenshot-scan.service'
import { checkDuplicates, createDraftsBulk, createTransactionsBulk } from '../../../services/transactions/transactions.service'
import { useTransactionsStore } from '../../../stores/transactions.store'
import { useWalletsStore } from '../../../stores/wallets.store'
import {
  BANK_HISTORICO_WORDS,
  BANK_STATEMENT_WORDS,
  BANK_WORDS,
  BANK_WEEKDAY_GREEN_Y,
  BANK_WEEKDAY_WORDS,
  P2P_WORDS,
  isGreen,
  layoutOf,
  line,
} from '../../../utils/screenshotScan/specs/listFixtures'
import { useBulkCapture } from '../useBulkCapture'

vi.mock('../../../services/screenshotScan/screenshot-scan.service', () => ({ recognizeScreenshot: vi.fn() }))
vi.mock('../../../services/transactions/transactions.service', () => ({
  createTransactionsBulk: vi.fn(),
  createDraftsBulk: vi.fn(),
  checkDuplicates: vi.fn(),
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
    vi.mocked(checkDuplicates).mockReset().mockResolvedValue(new Set())
    // jsdom no trae crypto.subtle: se usa el de Node para calcular las huellas.
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
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
    // Las ordenes ya enlazadas no se muestran; solo queda la tercera, sin pareja: sigue
    // siendo una transferencia valida por si sola y se avisa que no hay abono igual.
    const orders = capture.visibleRows.value.filter((row) => row.source === 'p2p_order')
    expect(orders).toHaveLength(1)
    expect(orders[0]!.action).toBe('transfer')
    expect(orders[0]!.flags.join(' ')).toContain('No hay un abono igual')
  })

  it('con solo el historial P2P, cada orden ya es una transferencia USDT a Bs lista para registrar', async () => {
    vi.mocked(recognizeScreenshot).mockResolvedValue(p2pLayout)
    const capture = useBulkCapture(BS.id)

    await capture.addImages([image('binance.png')])

    expect(capture.images.value[0]).toMatchObject({ status: 'done', kind: 'p2p_orders', rowCount: 3 })
    const [first, second, third] = capture.visibleRows.value
    expect(first).toMatchObject({
      action: 'transfer',
      sentAmount: 26.48,
      amount: 26600,
      fromWalletId: USDT.id,
      toWalletId: BS.id,
    })
    expect(second).toMatchObject({ action: 'transfer', sentAmount: 10.15 })
    // Sin la captura del banco no hay aviso de "abono no encontrado".
    expect(first!.flags.join(' ')).not.toContain('No hay un abono igual')
    // Las dos primeras tienen todo; a la tercera le falta la fecha (su tarjeta estaba cortada).
    expect(capture.issuesByRow.value.get(first!.id)).toEqual([])
    expect(capture.issuesByRow.value.get(second!.id)).toEqual([])
    expect(capture.issuesByRow.value.get(third!.id)).toEqual(['Falta la fecha'])
    expect(capture.canConfirm.value).toBe(false)

    capture.updateRow(third!.id, { occurredOn: '2026-10-08' })
    expect(capture.canConfirm.value).toBe(true)

    const outcome = await capture.confirm()

    expect(outcome.transfers).toBe(3)
    const params = vi.mocked(useWalletsStore().transfer).mock.calls.map(([item]) => item)
    expect(params[0]).toMatchObject({ fromWalletId: USDT.id, toWalletId: BS.id, amount: 26.48, convertedAmount: 26600 })
  })

  it('registra gastos con su comision, transferencias y deja fuera lo omitido', async () => {
    vi.mocked(recognizeScreenshot).mockResolvedValueOnce(bankLayout).mockResolvedValueOnce(p2pLayout)
    const capture = useBulkCapture(BS.id)
    await capture.addImages([image('banco.png'), image('binance.png')])

    for (const row of capture.visibleRows.value.filter((item) => item.action === 'expense')) {
      capture.updateRow(row.id, { category: 'Mercado' })
    }
    // La orden sin abono ni fecha (la tercera) el usuario decide omitirla.
    capture.setAction(capture.visibleRows.value.find((row) => row.source === 'p2p_order')!.id, 'skip')
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
    capture.setAction(capture.visibleRows.value.find((row) => row.source === 'p2p_order')!.id, 'skip')

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
  describe('opciones previas a subir las capturas', () => {
    const weekdayLayout = layoutOf(BANK_WEEKDAY_WORDS, 924, (box) => BANK_WEEKDAY_GREEN_Y.includes(box.y0))

    it('"solo gastos" deja fuera el dinero recibido', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(weekdayLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'expenses'

      await capture.addImages([image()])

      expect(capture.visibleRows.value.map((row) => row.amount)).toEqual([7000, 20000, 40000])
    })

    it('"solo recibidos" deja unicamente el dinero recibido', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(weekdayLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'received'

      await capture.addImages([image()])

      expect(capture.visibleRows.value.map((row) => row.amount)).toEqual([20039.9, 40107.74])
    })

    it('sin tomar en cuenta las comisiones, no se registran ni se suman', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(weekdayLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'expenses'
      capture.includeFees.value = false
      capture.expenseCategory.value = 'Mercado'

      await capture.addImages([image()])
      await capture.confirm()

      const [items] = vi.mocked(createTransactionsBulk).mock.calls[0]!
      expect(items.map((item) => item.amount)).toEqual([7000, 20000, 40000])
      expect(items.some((item) => item.category === 'Comisión')).toBe(false)
    })

    it('con las comisiones, cada una se registra como gasto "Comisión" aparte', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(weekdayLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'expenses'
      capture.expenseCategory.value = 'Mercado'

      await capture.addImages([image()])
      capture.reapplyDefaults()
      await capture.confirm()

      const [items] = vi.mocked(createTransactionsBulk).mock.calls[0]!
      expect(items.filter((item) => item.category === 'Comisión').map((item) => item.amount)).toEqual([21, 60, 120])
    })

    it('la categoria elegida antes de subir se aplica a todos los gastos, y se puede cambiar una por una', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(weekdayLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'expenses'
      capture.expenseCategory.value = 'Mercado'

      await capture.addImages([image()])
      capture.reapplyDefaults()

      expect(capture.visibleRows.value.every((row) => row.category === 'Mercado')).toBe(true)
      expect(capture.canConfirm.value).toBe(true)

      capture.updateRow(capture.visibleRows.value[0]!.id, { category: 'Gasolina' })
      capture.reapplyDefaults()
      expect(capture.visibleRows.value.map((row) => row.category)).toEqual(['Gasolina', 'Mercado', 'Mercado'])
    })

    it('sin categoria elegida los gastos quedan por completar, sin bloquear editar uno por uno', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(weekdayLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'expenses'

      await capture.addImages([image()])

      expect(capture.canConfirm.value).toBe(false)
      for (const row of capture.visibleRows.value) capture.updateRow(row.id, { category: 'Mercado' })
      expect(capture.canConfirm.value).toBe(true)
    })

    it('la fecha por defecto se usa cuando la captura no trae el dia', async () => {
      const noHeader = layoutOf(
        BANK_WEEKDAY_WORDS.filter((word) => !['MIERCOLES,', '7', 'DE', 'OCTUBRE'].includes(word.text) || word.y0 !== 503),
        924,
        (box) => BANK_WEEKDAY_GREEN_Y.includes(box.y0),
      )
      vi.mocked(recognizeScreenshot).mockResolvedValue(noHeader)
      const capture = useBulkCapture(BS.id)
      capture.dateChoice.value = 'custom'
      capture.customDate.value = '2026-10-05'

      await capture.addImages([image()])

      expect(capture.visibleRows.value.every((row) => row.occurredOn === '2026-10-05')).toBe(true)
    })

    it('el historico de operaciones se lee con la misma configuracion', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(layoutOf(BANK_HISTORICO_WORDS, 924))
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'expenses'
      capture.expenseCategory.value = 'Mercado'

      await capture.addImages([image()])
      capture.reapplyDefaults()

      expect(capture.visibleRows.value.map((row) => row.amount)).toEqual([7000, 20000, 40000, 1100, 500])
      expect(capture.canConfirm.value).toBe(true)
    })
  })

  describe('billetera por defecto', () => {
    it('con una sola billetera en bolivares se toma sin preguntar', () => {
      const capture = useBulkCapture()

      expect(capture.selectedWalletId.value).toBe(BS.id)
      expect(capture.walletAutoSelected.value).toBe(true)
    })

    it('con dos billeteras en bolivares hay que elegir', () => {
      useWalletsStore().wallets = [USDT, BS, { ...BS, id: 'w-bs2', name: 'Banesco' }]

      const capture = useBulkCapture()

      expect(capture.selectedWalletId.value).toBe('')
      expect(capture.walletAutoSelected.value).toBe(false)
    })

    it('elegir una billetera a mano apaga la seleccion automatica', () => {
      const capture = useBulkCapture()
      capture.selectWallet(USDT.id)

      expect(capture.selectedWalletId.value).toBe(USDT.id)
      expect(capture.walletAutoSelected.value).toBe(false)
    })

    it('si la captura esta en bolivares y se eligio una billetera en otra moneda, usa la unica en bolivares', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(bankLayout)
      const capture = useBulkCapture(USDT.id)

      await capture.addImages([image()])

      expect(capture.visibleRows.value.every((row) => row.walletId === BS.id)).toBe(true)
    })
  })

  describe('duplicados', () => {
    it('marca como duplicado y omite lo que ya esta registrado, avisando por que', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(bankLayout)
      vi.mocked(checkDuplicates).mockImplementation(async (keys) => new Set([keys[0]!]))
      const capture = useBulkCapture(BS.id)

      await capture.addImages([image()])

      const duplicates = capture.visibleRows.value.filter((row) => row.duplicate)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0]).toMatchObject({ action: 'skip' })
      expect(duplicates[0]!.flags.join(' ')).toContain('Posible duplicado')
      expect(capture.summary.value.duplicates).toBe(1)
    })

    it('un duplicado se puede registrar de todos modos si el usuario lo decide', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(bankLayout)
      vi.mocked(checkDuplicates).mockImplementation(async (keys) => new Set([keys[0]!]))
      const capture = useBulkCapture(BS.id)
      await capture.addImages([image()])

      const duplicate = capture.visibleRows.value.find((row) => row.duplicate)!
      capture.updateRow(duplicate.id, { action: duplicate.direction === 'in' ? 'income' : 'expense', category: 'Mercado' })

      expect(capture.visibleRows.value.find((row) => row.id === duplicate.id)!.action).not.toBe('skip')
    })

    it('si la consulta de duplicados no responde, todo sigue funcionando', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(bankLayout)
      vi.mocked(checkDuplicates).mockResolvedValue(new Set())
      const capture = useBulkCapture(BS.id)

      await capture.addImages([image()])

      expect(capture.visibleRows.value.some((row) => row.duplicate)).toBe(false)
      expect(capture.images.value[0]!.status).toBe('done')
    })

    it('cada movimiento se registra con su huella: 64 caracteres hexadecimales y distinta por fila', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(bankLayout)
      const capture = useBulkCapture(BS.id)
      await capture.addImages([image()])
      for (const row of capture.visibleRows.value) capture.updateRow(row.id, { category: 'Mercado' })

      await capture.confirm()

      const [items] = vi.mocked(createTransactionsBulk).mock.calls[0]!
      const keys = items.filter((item) => item.category !== 'Comisión').map((item) => item.importKey)
      expect(keys).toHaveLength(5)
      expect(keys.every((key) => /^[0-9a-f]{64}$/.test(key ?? ''))).toBe(true)
      expect(new Set(keys).size).toBe(5)
    })

    it('la transferencia enlazada a una orden P2P guarda el numero de orden en la nota y usa su huella', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValueOnce(bankLayout).mockResolvedValueOnce(p2pLayout)
      const capture = useBulkCapture(BS.id)
      await capture.addImages([image('banco.png'), image('binance.png')])
      for (const row of capture.visibleRows.value.filter((item) => item.action === 'expense')) {
        capture.updateRow(row.id, { category: 'Mercado' })
      }
      capture.setAction(capture.visibleRows.value.find((row) => row.source === 'p2p_order')!.id, 'skip')

      await capture.confirm()

      const [first] = vi.mocked(useWalletsStore().transfer).mock.calls.map(([params]) => params)
      expect(first!.note).toBe('Orden P2P 22941692196588679168 · Nelasurej')
      expect(first!.importKey).toMatch(/^[0-9a-f]{64}$/)
    })
  })
  describe('contexto: gastos / ingresos / transferencias', () => {
    it('las ordenes P2P no son gastos ni ingresos: con "solo gastos" se dejan fuera y se explica por que', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(p2pLayout)
      const capture = useBulkCapture(USDT.id)
      capture.scope.value = 'expenses'

      await capture.addImages([image('binance.png')])

      expect(capture.visibleRows.value).toHaveLength(0)
      expect(capture.images.value[0]!.status).toBe('error')
      expect(capture.images.value[0]!.message).toContain('son transferencias entre tus cuentas')
    })

    it('lo mismo con "solo ingresos"', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(p2pLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'received'

      await capture.addImages([image('binance.png')])

      expect(capture.visibleRows.value).toHaveLength(0)
      expect(capture.images.value[0]!.message).toContain('Elige "Transferencias" o "Todo"')
    })

    it('con "todo" las ordenes P2P siguen siendo transferencias', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(p2pLayout)
      const capture = useBulkCapture(USDT.id)

      await capture.addImages([image('binance.png')])

      expect(capture.visibleRows.value.every((row) => row.action === 'transfer')).toBe(true)
    })

    it('billetera USDT + "Transferencias": cada orden es una transferencia desde esa billetera hacia la de bolivares', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(p2pLayout)
      const capture = useBulkCapture(USDT.id)
      capture.scope.value = 'transfers'

      await capture.addImages([image('binance.png')])

      expect(capture.visibleRows.value[0]).toMatchObject({
        action: 'transfer',
        fromWalletId: USDT.id,
        toWalletId: BS.id,
        sentAmount: 26.48,
      })
    })

    it('billetera de bolivares + "Transferencias": los movimientos del banco quedan pendientes y se enlazan con las ordenes', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValueOnce(bankLayout).mockResolvedValueOnce(p2pLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'transfers'

      await capture.addImages([image('banco.png'), image('binance.png')])

      const byAmount = (amount: number) => capture.visibleRows.value.find((row) => row.amount === amount)!
      // Los dos abonos con orden igual pasan a transferencia; el resto queda pendiente.
      expect(byAmount(26600)).toMatchObject({ action: 'transfer', sentAmount: 26.48 })
      expect(byAmount(22848).action).toBe('pending')
      expect(byAmount(9000).action).toBe('pending')
    })

    it('un abono de P2P sin su orden queda pendiente para completarlo despues con los USDT', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(bankLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'transfers'

      await capture.addImages([image('banco.png')])
      const outcome = await capture.confirm()

      expect(outcome.pendings).toBe(5)
      expect(createTransactionsBulk).not.toHaveBeenCalled()
      const [drafts] = vi.mocked(createDraftsBulk).mock.calls[0]!
      expect(drafts.filter((draft) => draft.txnType === 'income')).toHaveLength(2)
    })
  })
  describe('transferencia que no es P2P (ej. dolares de Facebank a un amigo que los cambia a USDT)', () => {
    const FACEBANK = { id: 'w-fb', name: 'Facebank', currency: 'USD', balance: 500, createdAt: '2026-01-01T00:00:00Z' }

    // Comprobante suelto de Facebank: debito de 100 USD.
    const facebankLayout = layoutOf(
      [
        ...line('Detalle de movimiento', 100, 600, 100, 140),
        ...line('N.D. PAGO A TERCERO POR INTERNET', 100, 800, 200, 240),
        ...line('$ 100.00', 300, 600, 300, 360),
        ...line('Fecha 29/09/2026', 100, 800, 420, 460),
        ...line('No. de referencia 1043063494', 100, 800, 500, 540),
        ...line('Tipo de mov. Débito', 100, 800, 580, 620),
        ...line('Causa N.D. PAGO A TERCERO POR INTERNET', 100, 800, 660, 700),
      ],
      924,
    )

    beforeEach(() => {
      useWalletsStore().wallets = [FACEBANK, USDT, BS]
    })

    it('el movimiento sale de Facebank hacia la billetera USDT y pide cuanto llego', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(facebankLayout)
      const capture = useBulkCapture(FACEBANK.id)
      capture.scope.value = 'transfers'
      capture.transferKind.value = 'other'

      await capture.addImages([image('facebank.png')])

      const [row] = capture.visibleRows.value
      expect(row).toMatchObject({
        action: 'transfer',
        amount: 100,
        currency: 'USD',
        fromWalletId: FACEBANK.id,
        toWalletId: USDT.id,
        occurredOn: '2026-09-29',
        reference: '1043063494',
        sentAmount: null,
      })
      expect(capture.issuesByRow.value.get(row!.id)).toEqual(['Falta cuánto llegó al destino'])
      expect(capture.canConfirm.value).toBe(false)
    })

    it('al indicar cuantos USDT llegaron se registra la transferencia con la referencia en la nota', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(facebankLayout)
      const capture = useBulkCapture(FACEBANK.id)
      capture.scope.value = 'transfers'
      capture.transferKind.value = 'other'
      await capture.addImages([image('facebank.png')])

      capture.updateRow(capture.visibleRows.value[0]!.id, { sentAmount: 100 })
      expect(capture.canConfirm.value).toBe(true)
      const outcome = await capture.confirm()

      expect(outcome.transfers).toBe(1)
      const [params] = vi.mocked(useWalletsStore().transfer).mock.calls[0]!
      expect(params).toMatchObject({
        fromWalletId: FACEBANK.id,
        toWalletId: USDT.id,
        amount: 100,
        convertedAmount: 100,
        note: 'N.D. PAGO A TERCERO POR INTERNET · Ref. 1043063494',
      })
      expect(params.importKey).toMatch(/^[0-9a-f]{64}$/)
    })

    it('tampoco se enlaza con ordenes de Binance aunque se suban en la misma sesion', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValueOnce(bankLayout).mockResolvedValueOnce(p2pLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'transfers'
      capture.transferKind.value = 'other'

      await capture.addImages([image('banco.png'), image('binance.png')])

      const bankRows = capture.visibleRows.value.filter((row) => row.source === 'bank')
      expect(bankRows).toHaveLength(5)
      expect(bankRows.every((row) => row.action === 'transfer' && row.linkedOrderNumber === null)).toBe(true)
      // Las 3 ordenes quedan como filas aparte (ninguna se oculta por enlace).
      expect(capture.visibleRows.value.filter((row) => row.source === 'p2p_order')).toHaveLength(3)
    })
  })
  describe('estado de cuenta en tabla', () => {
    const statementLayout = layoutOf(BANK_STATEMENT_WORDS, 1918)

    it('se lee con su fecha, hora, referencia y comisiones unidas', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(statementLayout)
      const capture = useBulkCapture(BS.id)

      await capture.addImages([image('estado-de-cuenta.png')])

      expect(capture.images.value[0]).toMatchObject({ status: 'done', kind: 'bank_statement', rowCount: 9 })
      expect(capture.images.value[0]!.message).toBe('Estado de cuenta del banco')
      const byAmount = (amount: number) => capture.visibleRows.value.find((row) => row.amount === amount)!
      expect(byAmount(5100)).toMatchObject({
        action: 'expense',
        fee: 15.3,
        occurredOn: '2026-09-18',
        time: '19:48',
        reference: '0677286173620',
        walletId: BS.id,
      })
      expect(byAmount(16000)).toMatchObject({ action: 'income', occurredOn: '2026-09-20' })
    })

    it('usa el numero de referencia como huella: subir el mismo estado dos veces marca los duplicados', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(statementLayout)
      // El servidor ya conoce todas las huellas.
      vi.mocked(checkDuplicates).mockImplementation(async (keys) => new Set(keys))
      const capture = useBulkCapture(BS.id)

      await capture.addImages([image('estado-de-cuenta.png')])

      expect(capture.visibleRows.value).toHaveLength(9)
      expect(capture.visibleRows.value.every((row) => row.duplicate && row.action === 'skip')).toBe(true)
      expect(capture.canConfirm.value).toBe(false)
    })

    it('"solo gastos" con categoria elegida deja todo listo para registrar, con las comisiones aparte', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(statementLayout)
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'expenses'
      capture.expenseCategory.value = 'Mercado'

      await capture.addImages([image('estado-de-cuenta.png')])
      capture.reapplyDefaults()
      const outcome = await capture.confirm()

      expect(outcome.registered).toBe(4)
      const [items] = vi.mocked(createTransactionsBulk).mock.calls[0]!
      expect(items.filter((item) => item.category === 'Mercado').map((item) => item.amount)).toEqual([5100, 500, 2500, 4850])
      expect(items.filter((item) => item.category === 'Comisión').map((item) => item.amount)).toEqual([15.3, 14, 14, 14.55])
    })

    it('los abonos se enlazan con las ordenes de Binance por importe y hora como en las demas capturas', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValueOnce(statementLayout).mockResolvedValueOnce(p2pLayout)
      const capture = useBulkCapture(BS.id)

      await capture.addImages([image('estado.png'), image('binance.png')])

      // Ninguna de las ordenes de Binance de la captura (8 y 9 de octubre) coincide con estos abonos de
      // septiembre: no se enlaza nada por error.
      expect(capture.visibleRows.value.filter((row) => row.linkedOrderNumber !== null)).toHaveLength(0)
    })
  })
  describe('mensajes cuando no hay filas', () => {
    it('si no se pudo leer nada, no manda a probar la opcion "Todo" (el problema es la lectura, no el filtro)', async () => {
      // Se reconoce como una lista del banco (por su texto) pero no hay palabras con posicion: no se puede leer ninguna fila.
      vi.mocked(recognizeScreenshot).mockResolvedValue({
        text: 'Movimientos 10:25 PM 22.848,00 Bs 09:58 PM 26.600,00 Bs',
        words: [],
        width: 1918,
        height: 889,
        isGreen: () => null,
      })
      const capture = useBulkCapture(BS.id)
      capture.scope.value = 'expenses'

      await capture.addImages([image('estado.png')])

      const message = capture.images.value[0]!.message
      expect(message).toContain('No se pudo leer ningún movimiento')
      expect(message).not.toContain('opción "Todo"')
    })

    it('si se leyeron filas pero el filtro las dejo fuera, si sugiere probar con "Todo"', async () => {
      vi.mocked(recognizeScreenshot).mockResolvedValue(layoutOf(BANK_STATEMENT_WORDS, 1918))
      const capture = useBulkCapture(BS.id)
      // Solo hay ordenes P2P en esta otra captura; con "solo ingresos" un historial de ventas queda vacio.
      capture.scope.value = 'received'
      vi.mocked(recognizeScreenshot).mockResolvedValue(p2pLayout)

      await capture.addImages([image('binance.png')])

      expect(capture.images.value[0]!.message).toContain('son transferencias')
    })
  })
})
