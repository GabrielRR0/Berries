import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as walletsService from '../../../services/wallets/wallets.service'
import BalanceCard from '../BalanceCard.vue'

const BALANCE_HIDDEN_STORAGE_KEY = 'berry.balanceHidden'

describe('BalanceCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(walletsService, 'listWallets').mockResolvedValue([])
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Idea de la sesion de brainstorm de UI: sin esto, el monto grande
  // mostraba "$0.00" REAL (no un placeholder) mientras las wallets todavia
  // cargaban - en una conexion lenta se podia leer como el balance real.
  // Se controla la resolucion del fetch a mano (en vez de mockResolvedValue,
  // que ya resuelve solo) para poder verificar el estado de carga sin una
  // carrera de microtasks contra el propio fetch.
  it('muestra un indicador de carga mientras cargan las wallets, y el monto real despues', async () => {
    let resolveFetch!: (wallets: []) => void
    vi.mocked(walletsService.listWallets).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    const wrapper = mount(BalanceCard)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.loading-indicator').exists()).toBe(true)
    expect(wrapper.find('.balance-amount').exists()).toBe(false)

    resolveFetch([])
    await flushPromises()

    expect(wrapper.find('.loading-indicator').exists()).toBe(false)
    expect(wrapper.find('.balance-amount').exists()).toBe(true)
  })

  // Bug real reportado por el usuario: no habia endpoint de analitica para
  // el "+X% vs mes pasado" y el valor quedaba hardcodeado en 0 - mostraba un
  // dato falso siempre. Se saca la linea hasta tener un calculo real.
  it('no muestra ninguna leyenda de variacion mensual', async () => {
    const wrapper = mount(BalanceCard)
    await flushPromises()

    expect(wrapper.text()).not.toContain('vs mes pasado')
  })

  // Idea de la sesion de brainstorm: el toggle de "ocultar balance" no
  // persistia - volver a Inicio siempre lo mostraba de nuevo.
  describe('toggle de ocultar balance', () => {
    it('arranca visible cuando no hay preferencia guardada', async () => {
      const wrapper = mount(BalanceCard)
      await flushPromises()

      expect(wrapper.find('.eye-button').attributes('aria-label')).toBe('Ocultar balance')
    })

    it('tocar el ojo oculta el balance y guarda la preferencia', async () => {
      const wrapper = mount(BalanceCard)
      await flushPromises()

      await wrapper.find('.eye-button').trigger('click')

      expect(wrapper.find('.eye-button').attributes('aria-label')).toBe('Mostrar balance')
      expect(wrapper.text()).toContain('••••••')
      expect(localStorage.getItem(BALANCE_HIDDEN_STORAGE_KEY)).toBe('true')
    })

    it('un montaje nuevo respeta la preferencia guardada previamente', async () => {
      localStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, 'true')

      const wrapper = mount(BalanceCard)
      await flushPromises()

      expect(wrapper.find('.eye-button').attributes('aria-label')).toBe('Mostrar balance')
      expect(wrapper.text()).toContain('••••••')
    })

    it('tocar el ojo de nuevo vuelve a mostrar el balance y actualiza la preferencia', async () => {
      localStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, 'true')
      const wrapper = mount(BalanceCard)
      await flushPromises()

      await wrapper.find('.eye-button').trigger('click')

      expect(wrapper.find('.eye-button').attributes('aria-label')).toBe('Ocultar balance')
      expect(localStorage.getItem(BALANCE_HIDDEN_STORAGE_KEY)).toBe('false')
    })
  })
})
