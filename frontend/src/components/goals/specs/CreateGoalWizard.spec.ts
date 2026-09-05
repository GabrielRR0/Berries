import { createPinia, setActivePinia } from 'pinia'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as goalsService from '../../../services/goals/goals.service'
import type { SavingsCapacity } from '../../../services/goals/interfaces/goals.interface'
import * as walletsService from '../../../services/wallets/wallets.service'
import { monthsBetween } from '../../../utils/goals/monthsBetween'
import CreateGoalWizard from '../CreateGoalWizard.vue'

// El monto se escribe con el teclado nativo del telefono/navegador (pedido
// explicito del usuario: sacar los botones de numero a medida, que ademas
// tenian un bug real donde solo dejaba escribir un digito y se trababa) -
// un input type="number" comun, no un componente propio.
async function typeAmount(wrapper: ReturnType<typeof mount>, digits: string) {
  await wrapper.find('.wizard-amount-input').setValue(digits)
}

// "Ya tienes ahorrado" vive en un BottomSheet (Teleport a <body> - pedido
// explicito del usuario, segunda vuelta: "que sea una modal que aparezca
// desde abajo"). attachTo: document.body + DOMWrapper(document.body) es el
// mismo patron ya establecido en GoalCard.spec.ts/DebtCard.spec.ts para
// contenido teletransportado; hay que desmontar cada uno despues para no
// dejar sheets huerfanos pegados al body real entre tests.
const mountedWrappers: ReturnType<typeof mount>[] = []
function mountAttached(props: Record<string, unknown> = {}) {
  const wrapper = mount(CreateGoalWizard, { props, attachTo: document.body })
  mountedWrappers.push(wrapper)
  return wrapper
}

function inSheet(selector: string) {
  return new DOMWrapper(document.body).find(selector)
}

async function setInitialSavings(wrapper: ReturnType<typeof mount>, amount: string, note?: string) {
  const trigger = wrapper.find('.initial-savings-toggle').exists()
    ? wrapper.find('.initial-savings-toggle')
    : wrapper.find('.initial-savings-edit')
  await trigger.trigger('click')

  await inSheet('.initial-savings-amount-input').setValue(amount)
  if (note !== undefined) {
    await inSheet('.initial-savings-note').setValue(note)
  }
  const guardar = new DOMWrapper(document.body)
    .findAll('.initial-savings-sheet-actions button')
    .find((btn) => btn.text() === 'Guardar')!
  await guardar.trigger('click')
}

describe('CreateGoalWizard', () => {
  // Idea/pedido explicito del usuario ("puede ser de alguna billetera, o de un
  // ingreso futuro"): el wizard ahora hace su propio fetch de billeteras y de lo
  // ya comprometido en otras metas (useWalletsStore()/getWalletCommitments) - sin
  // esto, useWalletsStore() explota por falta de una Pinia activa en CUALQUIER
  // test de este archivo, no solo los que tocan billeteras.
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(walletsService, 'listWallets').mockResolvedValue([])
    vi.spyOn(goalsService, 'getWalletCommitments').mockResolvedValue([])
  })

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount()
    vi.restoreAllMocks()
  })

  it('arranca en el paso 1, mostrando el grid de plantillas', () => {
    const wrapper = mount(CreateGoalWizard)

    expect(wrapper.text()).toContain('¿Cuál es tu objetivo?')
    expect(wrapper.findAll('.type-tile').length).toBe(8) // 7 plantillas + Personalizada
  })

  it('elegir una plantilla avanza al paso 2 y precarga el titulo', async () => {
    const wrapper = mount(CreateGoalWizard)

    await wrapper.findAll('.type-tile').find((tile) => tile.text().includes('Comprar un computador'))!.trigger('click')

    expect(wrapper.find('.wizard-title-input').exists()).toBe(true)
    expect((wrapper.find('.wizard-title-input').element as HTMLInputElement).value).toBe('Comprar un computador')
  })

  it('"Personalizada" avanza al paso 2 sin precargar titulo', async () => {
    const wrapper = mount(CreateGoalWizard)

    await wrapper.find('.type-tile-custom').trigger('click')

    expect((wrapper.find('.wizard-title-input').element as HTMLInputElement).value).toBe('')
  })

  it('el boton de atras en el paso 2 vuelve al paso 1', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')

    await wrapper.find('.wizard-back').trigger('click')

    expect(wrapper.text()).toContain('¿Cuál es tu objetivo?')
  })

  it('el paso 1 no tiene boton de atras (cerrar el wizard es cosa del BottomSheet que lo contiene)', async () => {
    const wrapper = mount(CreateGoalWizard)

    expect(wrapper.find('.wizard-back').exists()).toBe(false)
  })

  it('escribir en el input actualiza el monto', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')

    await typeAmount(wrapper, '240')

    expect((wrapper.find('.wizard-amount-input').element as HTMLInputElement).value).toBe('240')
  })

  // Pedido explicito del usuario: "1300" se veia feo sin separador de miles.
  it('el input muestra el monto agrupado de a miles mientras se escribe', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')

    await typeAmount(wrapper, '233222')

    expect((wrapper.find('.wizard-amount-input').element as HTMLInputElement).value).toBe('233,222')
  })

  it('el monto sigue calculandose bien aunque se muestre agrupado (sin comas de mas al enviar)', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.findAll('.type-tile').find((tile) => tile.text().includes('Comprar un computador'))!.trigger('click')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')
    await wrapper.find('.wizard-next').trigger('click')

    await wrapper.find('.wizard-next').trigger('click')

    expect(wrapper.emitted('create')).toEqual([
      [{ title: 'Comprar un computador', targetAmount: 1200, currency: 'USD', targetDate: '2026-12-28', goalType: 'computer' }],
    ])
  })

  it('"Continuar" queda deshabilitado hasta completar titulo, fecha y monto', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')

    expect((wrapper.find('.wizard-next').element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')

    expect((wrapper.find('.wizard-next').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('"Continuar" avanza al resumen con los datos correctos', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')

    await wrapper.find('.wizard-next').trigger('click')

    expect(wrapper.text()).toContain('Resumen de tu meta')
    expect(wrapper.text()).toContain('MacBook')
    expect(wrapper.text()).toContain('$1,200.00')
  })

  it('"Crear meta" emite "create" con el goalType elegido', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.findAll('.type-tile').find((tile) => tile.text().includes('Comprar un computador'))!.trigger('click')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')
    await wrapper.find('.wizard-next').trigger('click')

    await wrapper.find('.wizard-next').trigger('click') // "Crear meta" reusa la misma clase en el paso 3

    expect(wrapper.emitted('create')).toEqual([
      [{ title: 'Comprar un computador', targetAmount: 1200, currency: 'USD', targetDate: '2026-12-28', goalType: 'computer' }],
    ])
  })

  it('modo "Aporte mensual" calcula el total segun los meses restantes', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('TV')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')

    await wrapper.findAll('.amount-mode-option').find((btn) => btn.text() === 'Aporte mensual')!.trigger('click')
    await typeAmount(wrapper, '80')

    expect(wrapper.find('.wizard-hint').exists()).toBe(true)
    expect(wrapper.find('.wizard-hint').text()).toContain('vas a reunir')
  })

  it('modo "Monto total" explica cuantos meses quedan y el promedio necesario', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')

    await typeAmount(wrapper, '2540')

    const hint = wrapper.find('.wizard-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('Te faltan')
    expect(hint.text()).toContain('$2,540.00')
    expect(hint.text()).toContain('completarías tu meta a tiempo')
  })

  it('modo "Monto total" con ahorro inicial menciona que se suma al promedio', async () => {
    const wrapper = mountAttached()
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '2540')
    await setInitialSavings(wrapper, '700')

    const hint = wrapper.find('.wizard-hint')
    expect(hint.text()).toContain('sumando los $700.00 que ya tienes ahorrados')
  })

  it('modo "Monto total" cuando lo ahorrado ya cubre la meta, avisa que no falta nada', async () => {
    const wrapper = mountAttached()
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '700')
    await setInitialSavings(wrapper, '700')

    const hint = wrapper.find('.wizard-hint')
    expect(hint.text()).toContain('cubre por completo tu meta')
    expect(hint.text()).toContain('No necesitas ahorrar nada más')
  })

  it('con datos de voz, salta directo al paso 2 prellenado', () => {
    const wrapper = mount(CreateGoalWizard, {
      props: {
        initialTitle: 'MacBook',
        initialAmount: 1200,
        initialAmountIsMonthly: false,
        initialCurrency: 'USD',
        initialTargetDate: '2026-12-28',
      },
    })

    expect(wrapper.find('.wizard-title-input').exists()).toBe(true)
    expect((wrapper.find('.wizard-title-input').element as HTMLInputElement).value).toBe('MacBook')
  })

  // "Ya tienes algo ahorrado" - pedido explicito del usuario: un headstart opcional
  // hacia la meta ("tengo $700 si vendo mi laptop"), con un detalle libre de donde
  // sale la plata.
  it('el bloque "ya tienes ahorrado" arranca colapsado, sin sheet abierto', async () => {
    const wrapper = mountAttached()
    await wrapper.find('.type-tile-custom').trigger('click')

    expect(wrapper.find('.initial-savings-toggle').exists()).toBe(true)
    expect(wrapper.find('.initial-savings-summary').exists()).toBe(false)
    expect(new DOMWrapper(document.body).find('.initial-savings-sheet-body').exists()).toBe(false)
  })

  it('tocar el toggle abre el sheet desde abajo, "Guardar" lo cierra y muestra el resumen', async () => {
    const wrapper = mountAttached()
    await wrapper.find('.type-tile-custom').trigger('click')

    await wrapper.find('.initial-savings-toggle').trigger('click')
    expect(inSheet('.initial-savings-sheet-body').exists()).toBe(true)

    await inSheet('.initial-savings-amount-input').setValue('700')
    const guardar = new DOMWrapper(document.body)
      .findAll('.initial-savings-sheet-actions button')
      .find((btn) => btn.text() === 'Guardar')!
    await guardar.trigger('click')

    expect(new DOMWrapper(document.body).find('.initial-savings-sheet-body').exists()).toBe(false)
    expect(wrapper.find('.initial-savings-summary').text()).toContain('$700.00')
  })

  it('"Cancelar" cierra el sheet sin guardar nada', async () => {
    const wrapper = mountAttached()
    await wrapper.find('.type-tile-custom').trigger('click')

    await wrapper.find('.initial-savings-toggle').trigger('click')
    await inSheet('.initial-savings-amount-input').setValue('700')
    const cancelar = new DOMWrapper(document.body)
      .findAll('.initial-savings-sheet-actions button')
      .find((btn) => btn.text() === 'Cancelar')!
    await cancelar.trigger('click')

    expect(new DOMWrapper(document.body).find('.initial-savings-sheet-body').exists()).toBe(false)
    expect(wrapper.find('.initial-savings-toggle').exists()).toBe(true)
    expect(wrapper.find('.initial-savings-summary').exists()).toBe(false)
  })

  it('"Quitar" en el resumen vuelve a mostrar el toggle', async () => {
    const wrapper = mountAttached()
    await wrapper.find('.type-tile-custom').trigger('click')
    await setInitialSavings(wrapper, '700')
    expect(wrapper.find('.initial-savings-summary').exists()).toBe(true)

    await wrapper.find('.initial-savings-remove').trigger('click')

    expect(wrapper.find('.initial-savings-summary').exists()).toBe(false)
    expect(wrapper.find('.initial-savings-toggle').exists()).toBe(true)
  })

  it('"Crear meta" incluye initialAmount/initialAmountNote cuando se completan', async () => {
    const wrapper = mountAttached()
    await wrapper.findAll('.type-tile').find((tile) => tile.text().includes('Comprar un computador'))!.trigger('click')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')
    await setInitialSavings(wrapper, '700', 'Si vendo mi laptop u otras pertenencias')
    await wrapper.find('.wizard-next').trigger('click')

    await wrapper.find('.wizard-next').trigger('click')

    expect(wrapper.emitted('create')).toEqual([
      [
        {
          title: 'Comprar un computador',
          targetAmount: 1200,
          currency: 'USD',
          targetDate: '2026-12-28',
          goalType: 'computer',
          initialAmount: 700,
          initialAmountNote: 'Si vendo mi laptop u otras pertenencias',
        },
      ],
    ])
  })

  it('sin nada ahorrado, "Crear meta" no manda initialAmount/initialAmountNote', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('TV')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '240')
    await wrapper.find('.wizard-next').trigger('click')

    await wrapper.find('.wizard-next').trigger('click')

    const [payload] = wrapper.emitted('create')![0] as [Record<string, unknown>]
    expect(payload.initialAmount).toBeUndefined()
    expect(payload.initialAmountNote).toBeUndefined()
  })

  it('el resumen muestra cuanto ya tiene ahorrado y su detalle', async () => {
    const wrapper = mountAttached()
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')
    await setInitialSavings(wrapper, '700', 'Si vendo mi laptop u otras pertenencias')

    await wrapper.find('.wizard-next').trigger('click')

    expect(wrapper.text()).toContain('Ya tienes ahorrado')
    expect(wrapper.text()).toContain('$700.00')
    expect(wrapper.text()).toContain('Si vendo mi laptop u otras pertenencias')
  })

  it('el ahorro ya reunido descuenta del aporte mensual sugerido (monto total)', async () => {
    const wrapper = mountAttached()
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')
    await setInitialSavings(wrapper, '1200')

    await wrapper.find('.wizard-next').trigger('click')

    // Objetivo ya cubierto del todo por lo ahorrado -> nada que sugerir por mes.
    expect(wrapper.text()).toContain('Ahorro mensual')
    expect(wrapper.text()).toContain('$0.00 / mes')
  })

  it('modo "Aporte mensual" suma lo ya ahorrado al total estimado', async () => {
    const wrapper = mountAttached()
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('TV')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await setInitialSavings(wrapper, '700')

    await wrapper.findAll('.amount-mode-option').find((btn) => btn.text() === 'Aporte mensual')!.trigger('click')
    await typeAmount(wrapper, '80')

    const months = monthsBetween(new Date(), new Date('2026-12-28'))
    const expectedTotal = (80 * months + 700).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const hint = wrapper.find('.wizard-hint').text()
    expect(hint).toContain('más los $700.00 que ya tienes ahorrados')
    expect(hint).toContain(`vas a reunir $${expectedTotal}`)
  })

  it('avisa cuando el aporte implicito supera el disponible promedio', async () => {
    const capacity: SavingsCapacity = { avgMonthlyIncome: 500, avgMonthlyExpense: 480, avgMonthlyAvailable: 20, hasEnoughHistory: true }
    const wrapper = mount(CreateGoalWizard, { props: { savingsCapacity: capacity } })
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('input[type="date"]').setValue('2026-09-28')

    await typeAmount(wrapper, '1000')

    const hint = wrapper.find('.capacity-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.classes()).toContain('warning')
  })

  // Pedido explicito del usuario: una cuenta nueva (el mes en curso todavia no
  // termino) no tiene un "promedio" real todavia - no comparar nada contra eso.
  it('no muestra la comparacion de capacidad si la cuenta no tiene suficiente historial', async () => {
    const capacity: SavingsCapacity = { avgMonthlyIncome: 0, avgMonthlyExpense: 5510.01, avgMonthlyAvailable: -5510.01, hasEnoughHistory: false }
    const wrapper = mount(CreateGoalWizard, { props: { savingsCapacity: capacity } })
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('input[type="date"]').setValue('2026-09-28')

    await typeAmount(wrapper, '1000')

    expect(wrapper.find('.capacity-hint').exists()).toBe(false)
  })

  // Pedido explicito del usuario: "de donde lo voy a sacar, puede ser de alguna
  // billetera, o de un ingreso futuro". Confirmado: reserva blanda (nunca mueve
  // plata real), solo billeteras de la misma moneda que la meta.
  describe('fuente del aporte inicial (billetera vs. ingreso futuro)', () => {
    const WALLET_USD = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 1000, createdAt: '2026-01-01T00:00:00Z' }
    const WALLET_EUR = { id: 'wallet-2', name: 'Banco EUR', currency: 'EUR', balance: 500, createdAt: '2026-01-01T00:00:00Z' }

    async function goToWalletPill(wrapper: ReturnType<typeof mount>) {
      const trigger = wrapper.find('.initial-savings-toggle').exists()
        ? wrapper.find('.initial-savings-toggle')
        : wrapper.find('.initial-savings-edit')
      await trigger.trigger('click')
      const billeteraPill = new DOMWrapper(document.body).findAll('.pill').find((btn) => btn.text() === 'Billetera')!
      await billeteraPill.trigger('click')
    }

    it('sin tocar nada, por defecto queda en "Ingreso futuro" (sin cambios de comportamiento)', async () => {
      const wrapper = mountAttached()
      await wrapper.find('.type-tile-custom').trigger('click')
      await wrapper.find('.initial-savings-toggle').trigger('click')

      const futuroPill = inSheet('.pill-toggle .pill.active')
      expect(futuroPill.text()).toBe('Ingreso futuro')
      expect(inSheet('.initial-savings-note').exists()).toBe(true)
    })

    it('el selector de billetera solo ofrece billeteras de la misma moneda que la meta', async () => {
      vi.mocked(walletsService.listWallets).mockResolvedValue([WALLET_USD, WALLET_EUR])
      const wrapper = mountAttached()
      await wrapper.find('.type-tile-custom').trigger('click')
      await flushPromises()
      await goToWalletPill(wrapper)

      const options = inSheet('.initial-savings-wallet-field select')
        .findAll('option')
        .map((o) => o.text())
      expect(options.some((text) => text.includes('Efectivo'))).toBe(true)
      expect(options.some((text) => text.includes('Banco EUR'))).toBe(false)
    })

    // Pedido explicito del usuario: "en billetera no me deja usar usdt, seria bueno
    // que si es dolares, acepte dolares y usdt" - mismo criterio 1:1 ya establecido
    // para deudas (AddDebtPaymentForm.vue/debt_payment_service.py).
    it('el selector tambien ofrece billeteras USDT para una meta en USD (y viceversa)', async () => {
      const WALLET_USDT = { id: 'wallet-3', name: 'Binance', currency: 'USDT', balance: 500, createdAt: '2026-01-01T00:00:00Z' }
      vi.mocked(walletsService.listWallets).mockResolvedValue([WALLET_USD, WALLET_USDT])
      const wrapper = mountAttached()
      await wrapper.find('.type-tile-custom').trigger('click')
      await flushPromises()
      await goToWalletPill(wrapper)

      const options = inSheet('.initial-savings-wallet-field select')
        .findAll('option')
        .map((o) => o.text())
      expect(options.some((text) => text.includes('Efectivo'))).toBe(true)
      expect(options.some((text) => text.includes('Binance'))).toBe(true)
    })

    it('bloquea "Guardar" si el monto supera el disponible de la billetera elegida', async () => {
      vi.mocked(walletsService.listWallets).mockResolvedValue([WALLET_USD])
      vi.mocked(goalsService.getWalletCommitments).mockResolvedValue([])
      const wrapper = mountAttached()
      await wrapper.find('.type-tile-custom').trigger('click')
      await flushPromises()
      await goToWalletPill(wrapper)

      await inSheet('.initial-savings-amount-input').setValue('5000')
      await inSheet('.initial-savings-wallet-field select').setValue('wallet-1')

      const guardar = new DOMWrapper(document.body)
        .findAll('.initial-savings-sheet-actions button')
        .find((btn) => btn.text() === 'Guardar')!
      expect(guardar.attributes('disabled')).toBeDefined()
      expect(inSheet('.capacity-hint.warning').exists()).toBe(true)
    })

    it('descuenta lo ya comprometido en otras metas al validar el disponible', async () => {
      vi.mocked(walletsService.listWallets).mockResolvedValue([WALLET_USD])
      vi.mocked(goalsService.getWalletCommitments).mockResolvedValue([{ walletId: 'wallet-1', committedAmount: 950 }])
      const wrapper = mountAttached()
      await wrapper.find('.type-tile-custom').trigger('click')
      await flushPromises()
      await goToWalletPill(wrapper)

      // Saldo real 1000, ya comprometido 950 -> disponible real 50, pedir 100 no alcanza.
      await inSheet('.initial-savings-amount-input').setValue('100')
      await inSheet('.initial-savings-wallet-field select').setValue('wallet-1')

      const guardar = new DOMWrapper(document.body)
        .findAll('.initial-savings-sheet-actions button')
        .find((btn) => btn.text() === 'Guardar')!
      expect(guardar.attributes('disabled')).toBeDefined()
    })

    it('"Crear meta" incluye initialAmountWalletId cuando se elige una billetera', async () => {
      vi.mocked(walletsService.listWallets).mockResolvedValue([WALLET_USD])
      const wrapper = mountAttached()
      await wrapper.findAll('.type-tile').find((tile) => tile.text().includes('Comprar un computador'))!.trigger('click')
      await wrapper.find('input[type="date"]').setValue('2026-12-28')
      await typeAmount(wrapper, '1200')
      await flushPromises()
      await goToWalletPill(wrapper)
      await inSheet('.initial-savings-amount-input').setValue('700')
      await inSheet('.initial-savings-wallet-field select').setValue('wallet-1')
      await new DOMWrapper(document.body)
        .findAll('.initial-savings-sheet-actions button')
        .find((btn) => btn.text() === 'Guardar')!
        .trigger('click')
      await wrapper.find('.wizard-next').trigger('click')

      await wrapper.find('.wizard-next').trigger('click')

      const [payload] = wrapper.emitted('create')![0] as [Record<string, unknown>]
      expect(payload.initialAmountWalletId).toBe('wallet-1')
      expect(wrapper.text()).not.toContain('Ingreso futuro')
    })

    it('el resumen del paso 3 muestra "Ingreso futuro" cuando no se enlaza billetera', async () => {
      const wrapper = mountAttached()
      await wrapper.find('.type-tile-custom').trigger('click')
      await wrapper.find('.wizard-title-input').setValue('TV')
      await wrapper.find('input[type="date"]').setValue('2026-12-28')
      await typeAmount(wrapper, '240')
      await setInitialSavings(wrapper, '100')
      await wrapper.find('.wizard-next').trigger('click')

      expect(wrapper.text()).toContain('Ingreso futuro')
    })
  })
})
