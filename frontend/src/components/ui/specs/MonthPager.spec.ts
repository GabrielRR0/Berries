import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MonthPager from '../MonthPager.vue'

describe('MonthPager', () => {
  it('muestra el mes y año formateados', () => {
    const wrapper = mount(MonthPager, { props: { year: 2026, month: 7 } })

    expect(wrapper.text()).toContain('Agosto de 2026')
  })

  it('emite "change" con el mes anterior al hacer click en la flecha izquierda', async () => {
    const wrapper = mount(MonthPager, { props: { year: 2026, month: 7 } })

    await wrapper.find('[aria-label="Mes anterior"]').trigger('click')

    expect(wrapper.emitted('change')![0]).toEqual([2026, 6])
  })

  it('emite "change" con el mes siguiente al hacer click en la flecha derecha', async () => {
    const wrapper = mount(MonthPager, { props: { year: 2026, month: 7 } })

    await wrapper.find('[aria-label="Mes siguiente"]').trigger('click')

    expect(wrapper.emitted('change')![0]).toEqual([2026, 8])
  })

  it('retrocede de enero al diciembre del año anterior', async () => {
    const wrapper = mount(MonthPager, { props: { year: 2026, month: 0 } })

    await wrapper.find('[aria-label="Mes anterior"]').trigger('click')

    expect(wrapper.emitted('change')![0]).toEqual([2025, 11])
  })

  it('avanza de diciembre a enero del año siguiente', async () => {
    const wrapper = mount(MonthPager, { props: { year: 2026, month: 11 } })

    await wrapper.find('[aria-label="Mes siguiente"]').trigger('click')

    expect(wrapper.emitted('change')![0]).toEqual([2027, 0])
  })
})
