import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { isAnySheetOpen, trackSheetPresence } from '../useSheetPresence'

const FakeSheet = defineComponent({
  setup() {
    trackSheetPresence()
    return () => h('div')
  },
})

describe('useSheetPresence', () => {
  it('hay un sheet abierto mientras el componente esta montado y deja de haberlo al desmontarlo', () => {
    expect(isAnySheetOpen.value).toBe(false)

    const first = mount(FakeSheet)
    const second = mount(FakeSheet)
    expect(isAnySheetOpen.value).toBe(true)

    first.unmount()
    expect(isAnySheetOpen.value).toBe(true)

    second.unmount()
    expect(isAnySheetOpen.value).toBe(false)
  })
})
