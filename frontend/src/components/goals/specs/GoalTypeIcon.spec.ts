import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { GoalType } from '../../../services/goals/interfaces/goals.interface'
import GoalTypeIcon from '../GoalTypeIcon.vue'

const ALL_TYPES: GoalType[] = ['study', 'business', 'course', 'housing', 'travel', 'vehicle', 'computer', 'phone', 'custom']

describe('GoalTypeIcon', () => {
  it.each(ALL_TYPES)('renderiza un svg para el tipo "%s"', (type) => {
    const wrapper = mount(GoalTypeIcon, { props: { type } })

    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('svg path').exists()).toBe(true)
  })

  it('cada tipo tiene su propio path (no todos caen al mismo default)', () => {
    const paths = ALL_TYPES.map((type) => mount(GoalTypeIcon, { props: { type } }).find('path').attributes('d'))

    expect(new Set(paths).size).toBe(ALL_TYPES.length)
  })
})
