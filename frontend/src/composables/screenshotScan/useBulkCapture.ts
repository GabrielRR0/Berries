import { computed, ref, watch } from 'vue'
import { recognizeScreenshot } from '../../services/screenshotScan/screenshot-scan.service'
import { checkDuplicates, createDraftsBulk, createTransactionsBulk } from '../../services/transactions/transactions.service'
import { useTransactionsStore } from '../../stores/transactions.store'
import { useWalletsStore } from '../../stores/wallets.store'
import { buildConfirmPlan, rowIssues } from '../../utils/screenshotScan/confirmPlan'
import { matchP2pOrders } from '../../utils/screenshotScan/matchP2pOrders'
import type { RowAction, ScanRow } from '../../utils/screenshotScan/movementRows'
import { applyScanContext } from '../../utils/screenshotScan/applyScanContext'
import type { TransferKind } from '../../utils/screenshotScan/applyScanContext'
import { applyCategoryDefaults, applyRowDefaults } from '../../utils/screenshotScan/rowDefaults'
import { importKeyFor } from '../../utils/screenshotScan/rowFingerprint'
import { rowsFromImage } from '../../utils/screenshotScan/rowsFromImage'
import type { ImageKind, ScanScope } from '../../utils/screenshotScan/rowsFromImage'

export type DateChoice = 'today' | 'yesterday' | 'custom'

export interface CaptureImage {
  id: number
  name: string
  url: string
  status: 'reading' | 'done' | 'error'
  kind: ImageKind | null
  rowCount: number
  message: string
}

export interface ConfirmOutcome {
  registered: number
  pendings: number
  transfers: number
  skipped: number
  failures: { label: string; message: string }[]
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

const DUPLICATE_FLAG =
  'Posible duplicado: ya registraste un movimiento igual. Se omite; elige otra opción para registrarlo de todos modos.'

const UNMATCHED_ORDER_FLAG = 'No hay un abono igual en la captura del banco. Se registrará como transferencia por sí sola.'

const KIND_LABEL: Record<ImageKind, string> = {
  bank_statement: 'Estado de cuenta del banco',
  p2p_orders: 'Historial de órdenes P2P',
  bank_list: 'Lista de movimientos del banco',
  single: 'Un movimiento',
  unknown: 'No reconocida',
}

// Estado y acciones del registro desde capturas. Cada vez que se agrega una
// imagen se leen sus filas, se completan las billeteras que se pueden deducir y se
// enlazan los recibidos del banco con las ordenes P2P (que traen los USDT).
export function useBulkCapture(initialWalletId = '') {
  const walletsStore = useWalletsStore()
  const transactionsStore = useTransactionsStore()

  const selectedWalletId = ref(initialWalletId)
  // true mientras la billetera salio elegida sola (porque era la unica posible).
  const walletAutoSelected = ref(false)
  const dateChoice = ref<DateChoice>('yesterday')
  const customDate = ref('')
  // Opciones que se eligen antes de subir las capturas.
  const scope = ref<ScanScope>('all')
  // Solo cuando scope es 'transfers': P2P de Binance u otra transferencia entre cuentas propias.
  const transferKind = ref<TransferKind>('p2p')
  const includeFees = ref(true)
  const expenseCategory = ref('')
  const incomeCategory = ref('')
  const images = ref<CaptureImage[]>([])
  const rows = ref<ScanRow[]>([])
  const isConfirming = ref(false)
  // Filas cuya accion eligio el usuario: un enlace automatico posterior no la pisa.
  const touched = new Set<string>()
  let imageCounter = 0

  const defaultDate = computed(() => {
    const today = new Date()
    if (dateChoice.value === 'today') return isoDate(today)
    if (dateChoice.value === 'yesterday') return isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))
    return customDate.value || null
  })

  // Si no se elige billetera, se toma la unica posible: la unica que tiene el usuario o su unica
  // billetera en bolivares (las capturas de bancos venezolanos estan en bolivares). Con varias hay
  // que elegir.
  function autoSelectWallet() {
    if (selectedWalletId.value) return
    const wallets = walletsStore.wallets
    const bolivarWallets = wallets.filter((wallet) => wallet.currency === 'VEF')
    const only = wallets.length === 1 ? wallets[0] : bolivarWallets.length === 1 ? bolivarWallets[0] : null
    if (only) {
      selectedWalletId.value = only.id
      walletAutoSelected.value = true
    }
  }
  watch(() => walletsStore.wallets, autoSelectWallet, { immediate: true })

  function selectWallet(walletId: string) {
    selectedWalletId.value = walletId
    walletAutoSelected.value = false
  }

  // Las ordenes ya enlazadas con un recibido no se muestran: su informacion vive en el recibido.
  const visibleRows = computed(() => rows.value.filter((row) => !(row.source === 'p2p_order' && row.linkedOrderNumber !== null)))
  const isReading = computed(() => images.value.some((image) => image.status === 'reading'))

  const issuesByRow = computed(() => {
    const map = new Map<string, string[]>()
    for (const row of visibleRows.value) map.set(row.id, rowIssues(row))
    return map
  })
  const blockedRows = computed(() => visibleRows.value.filter((row) => (issuesByRow.value.get(row.id) ?? []).length > 0))
  const flaggedRows = computed(() => visibleRows.value.filter((row) => row.action !== 'skip' && row.flags.length > 0))
  const canConfirm = computed(
    () => visibleRows.value.some((row) => row.action !== 'skip') && blockedRows.value.length === 0 && !isConfirming.value,
  )

  const summary = computed(() => {
    const plan = buildConfirmPlan(visibleRows.value.filter((row) => (issuesByRow.value.get(row.id) ?? []).length === 0))
    const expenses = visibleRows.value.filter((row) => row.action === 'expense')
    const incomes = visibleRows.value.filter((row) => row.action === 'income')
    const sum = (list: ScanRow[]) => list.reduce((total, row) => total + row.amount + (row.action === 'expense' ? row.fee : 0), 0)
    return {
      expenses: expenses.length,
      expensesTotal: sum(expenses),
      incomes: incomes.length,
      incomesTotal: sum(incomes),
      transfers: plan.transfers.length,
      pendings: visibleRows.value.filter((row) => row.action === 'pending').length,
      skipped: visibleRows.value.filter((row) => row.action === 'skip').length,
      duplicates: visibleRows.value.filter((row) => row.duplicate && row.action === 'skip').length,
    }
  })

  function relink() {
    // Solo los recibidos/gastos que el usuario no toco entran al enlace automatico.
    const eligible = rows.value.filter((row) => row.source === 'p2p_order' || !touched.has(row.id))
    // Una transferencia "otra" (sin Binance) no se enlaza con ordenes P2P.
    const linkWithOrders = !(scope.value === 'transfers' && transferKind.value === 'other')
    if (linkWithOrders) matchP2pOrders(eligible)

    // Si hay una captura del banco y una orden no encontro su abono, se avisa (puede ser de
    // otro dia o de otra cuenta); la orden sigue siendo una transferencia valida por si sola.
    const hasBankRows = linkWithOrders && rows.value.some((row) => row.source === 'bank')
    for (const row of rows.value) {
      if (row.source !== 'p2p_order' || row.linkedOrderNumber !== null) continue
      row.flags = row.flags.filter((flag) => flag !== UNMATCHED_ORDER_FLAG)
      if (hasBankRows) row.flags.push(UNMATCHED_ORDER_FLAG)
    }
    reapplyDefaults()
  }

  // Marca como duplicadas las filas que ya estan registradas (misma huella). Es una ayuda
  // opcional: si no hay conexion o falla, las filas quedan como estan.
  async function markDuplicates(candidates: ScanRow[]) {
    const byKey = new Map<string, ScanRow[]>()
    for (const row of candidates) {
      if (row.duplicate || touched.has(row.id)) continue
      if (row.source === 'p2p_order' && row.linkedOrderNumber !== null) continue
      const key = await importKeyFor(row)
      if (key) byKey.set(key, [...(byKey.get(key) ?? []), row])
    }
    const existing = await checkDuplicates([...byKey.keys()])
    for (const [key, matches] of byKey) {
      if (!existing.has(key)) continue
      for (const row of matches) {
        row.duplicate = true
        row.action = 'skip'
        row.flags = [...row.flags.filter((flag) => flag !== DUPLICATE_FLAG), DUPLICATE_FLAG]
        touched.add(row.id)
      }
    }
  }

  async function addImage(file: File) {
    imageCounter += 1
    const image: CaptureImage = {
      id: imageCounter,
      name: file.name,
      url: URL.createObjectURL(file),
      status: 'reading',
      kind: null,
      rowCount: 0,
      message: '',
    }
    images.value.push(image)
    // La referencia reactiva (la del arreglo) es la que se muta de aqui en adelante.
    const tracked = images.value[images.value.length - 1]!

    try {
      const layout = await recognizeScreenshot(file)
      const result = rowsFromImage(layout, {
        today: new Date(),
        defaultDate: defaultDate.value,
        scope: scope.value,
        includeFees: includeFees.value,
      })
      // El contexto elegido antes de subir (gastos, ingresos, P2P) decide como se toman las filas.
      const newRows = applyScanContext(result.rows, { scope: scope.value, transferKind: transferKind.value })
      tracked.kind = result.kind
      tracked.rowCount = newRows.length
      if (result.kind === 'unknown' || newRows.length === 0) {
        tracked.status = 'error'
        tracked.message =
          result.kind === 'unknown'
            ? 'No se reconoció este tipo de captura. Por ahora se leen listas y estados de cuenta del banco, historial de órdenes P2P de Binance y comprobantes sueltos.'
            : scope.value === 'all'
              ? 'No se encontraron movimientos en esta captura.'
              : result.kind === 'p2p_orders' && (scope.value === 'expenses' || scope.value === 'received')
                ? 'Las órdenes P2P son transferencias entre tus cuentas, no gastos ni ingresos. Elige "Transferencias" o "Todo".'
                : 'No hay movimientos de ese tipo en esta captura. Prueba con la opción "Todo".'
        return
      }
      rows.value.push(...newRows)
      relink()
      await markDuplicates(rows.value)
      tracked.status = 'done'
      tracked.message = KIND_LABEL[result.kind]
    } catch (error) {
      tracked.status = 'error'
      tracked.message = errorMessage(error, 'No se pudo leer la captura.')
    }
  }

  async function addImages(files: File[]) {
    // De una en una: Tesseract es pesado y varias a la vez saturan un celular.
    for (const file of files) {
      if (!(file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name))) {
        imageCounter += 1
        images.value.push({
          id: imageCounter,
          name: file.name,
          url: '',
          status: 'error',
          kind: null,
          rowCount: 0,
          message: 'Ese archivo no es una imagen. Elige una captura de pantalla en PNG o JPG.',
        })
        continue
      }
      await addImage(file)
    }
  }

  function removeImage(id: number) {
    const image = images.value.find((item) => item.id === id)
    if (image?.url) URL.revokeObjectURL(image.url)
    images.value = images.value.filter((item) => item.id !== id)
  }

  function updateRow(id: string, changes: Partial<ScanRow>) {
    const row = rows.value.find((item) => item.id === id)
    if (!row) return
    Object.assign(row, changes)
    if (changes.action !== undefined) {
      touched.add(id)
      // Al pasar a transferencia o pendiente se rellenan las billeteras deducibles.
      applyRowDefaults([row], { wallets: walletsStore.wallets, selectedWalletId: selectedWalletId.value })
    }
  }

  function setAction(id: string, action: RowAction) {
    updateRow(id, { action })
  }

  // Cambiar la billetera o las categorias del primer paso despues de leer: las filas que no
  // tienen una propia heredan la nueva.
  function reapplyDefaults() {
    applyRowDefaults(rows.value, { wallets: walletsStore.wallets, selectedWalletId: selectedWalletId.value })
    applyCategoryDefaults(rows.value, { expenseCategory: expenseCategory.value, incomeCategory: incomeCategory.value })
  }

  function reset() {
    for (const image of images.value) if (image.url) URL.revokeObjectURL(image.url)
    images.value = []
    rows.value = []
    touched.clear()
  }

  async function confirm(): Promise<ConfirmOutcome> {
    const outcome: ConfirmOutcome = { registered: 0, pendings: 0, transfers: 0, skipped: 0, failures: [] }
    if (!canConfirm.value) return outcome

    isConfirming.value = true
    try {
      // Cada movimiento se registra con su huella (con los datos ya corregidos por el usuario) para
      // detectar despues que ya existe.
      const importKeys = new Map<string, string>()
      for (const row of visibleRows.value) {
        if (row.action !== 'expense' && row.action !== 'income' && row.action !== 'transfer') continue
        const key = await importKeyFor(row)
        if (key) importKeys.set(row.id, key)
      }
      const plan = buildConfirmPlan(visibleRows.value, importKeys)
      outcome.skipped = plan.skipped
      const doneIds = new Set<string>()

      // 1) Gastos e ingresos: un lote atomico. Si falla, no se crea nada y se corta aqui.
      const batchRows = visibleRows.value.filter((row) => row.action === 'expense' || row.action === 'income')
      if (plan.transactions.length > 0) {
        try {
          await createTransactionsBulk(plan.transactions)
          outcome.registered = batchRows.length
          batchRows.forEach((row) => doneIds.add(row.id))
        } catch (error) {
          outcome.failures.push({
            label: 'Gastos e ingresos',
            message: errorMessage(error, 'No se pudieron registrar los movimientos.'),
          })
          return outcome
        }
      }

      // 2) Pendientes guardados en el servidor.
      const pendingRows = visibleRows.value.filter((row) => row.action === 'pending')
      if (plan.drafts.length > 0) {
        try {
          await createDraftsBulk(plan.drafts)
          outcome.pendings = plan.drafts.length
          pendingRows.forEach((row) => doneIds.add(row.id))
        } catch (error) {
          outcome.failures.push({ label: 'Pendientes', message: errorMessage(error, 'No se pudieron guardar los pendientes.') })
        }
      }

      // 3) Transferencias, una por una (cada una valida saldo y monedas por su cuenta).
      for (const transfer of plan.transfers) {
        try {
          await walletsStore.transfer(transfer.params)
          outcome.transfers += 1
          doneIds.add(transfer.rowId)
        } catch (error) {
          outcome.failures.push({ label: transfer.label, message: errorMessage(error, 'No se pudo hacer la transferencia.') })
        }
      }

      // Las filas ya registradas salen de la lista: reintentar no las duplica.
      rows.value = rows.value.filter((row) => !doneIds.has(row.id))
      await Promise.allSettled([walletsStore.fetchWallets({ force: true }), transactionsStore.fetchTransactions({ force: true })])
      return outcome
    } finally {
      isConfirming.value = false
    }
  }

  return {
    selectedWalletId,
    walletAutoSelected,
    selectWallet,
    scope,
    transferKind,
    includeFees,
    expenseCategory,
    incomeCategory,
    dateChoice,
    customDate,
    defaultDate,
    images,
    rows,
    visibleRows,
    issuesByRow,
    blockedRows,
    flaggedRows,
    canConfirm,
    summary,
    isReading,
    isConfirming,
    addImages,
    removeImage,
    updateRow,
    setAction,
    reapplyDefaults,
    reset,
    confirm,
  }
}
