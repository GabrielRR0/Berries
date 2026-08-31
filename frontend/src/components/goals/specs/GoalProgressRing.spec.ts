import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GoalProgressRing from '../GoalProgressRing.vue'

const CIRCUMFERENCE = 2 * Math.PI * 42

describe('GoalProgressRing', () => {
  it('en 0%, el arco no tiene relleno (dashoffset = circunferencia completa)', () => {
    const wrapper = mount(GoalProgressRing, { props: { percent: 0 } })

    const fill = wrapper.find('.ring-fill')
    expect(Number(fill.attributes('stroke-dashoffset'))).toBeCloseTo(CIRCUMFERENCE)
  })

  it('en 100%, el arco esta completamente relleno (dashoffset = 0)', () => {
    const wrapper = mount(GoalProgressRing, { props: { percent: 100 } })

    const fill = wrapper.find('.ring-fill')
    expect(Number(fill.attributes('stroke-dashoffset'))).toBeCloseTo(0)
  })

  it('en 50%, el arco esta relleno a la mitad', () => {
    const wrapper = mount(GoalProgressRing, { props: { percent: 50 } })

    const fill = wrapper.find('.ring-fill')
    expect(Number(fill.attributes('stroke-dashoffset'))).toBeCloseTo(CIRCUMFERENCE / 2)
  })

  it('nunca muestra el punto final en 0% (nada que marcar)', () => {
    const wrapper = mount(GoalProgressRing, { props: { percent: 0 } })

    expect(wrapper.find('.ring-end-dot').exists()).toBe(false)
  })

  it('muestra el punto final apenas hay progreso', () => {
    const wrapper = mount(GoalProgressRing, { props: { percent: 2 } })

    expect(wrapper.find('.ring-end-dot').exists()).toBe(true)
  })

  it('acota valores fuera de rango (negativos o mayores a 100)', () => {
    const negative = mount(GoalProgressRing, { props: { percent: -10 } })
    const over = mount(GoalProgressRing, { props: { percent: 150 } })

    expect(Number(negative.find('.ring-fill').attributes('stroke-dashoffset'))).toBeCloseTo(CIRCUMFERENCE)
    expect(Number(over.find('.ring-fill').attributes('stroke-dashoffset'))).toBeCloseTo(0)
  })

  it('renderiza el contenido del slot en el centro', () => {
    const wrapper = mount(GoalProgressRing, {
      props: { percent: 50 },
      slots: { default: '<span class="my-icon">★</span>' },
    })

    expect(wrapper.find('.ring-center .my-icon').exists()).toBe(true)
  })
})
