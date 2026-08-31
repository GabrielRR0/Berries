import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCategory,
  listCategories,
} from '../../../services/categories/categories.service'
import type { Category } from '../../../services/categories/interfaces/categories.interface'
import CategoryField from '../CategoryField.vue'

vi.mock('../../../services/categories/categories.service', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  hideCategory: vi.fn(),
  unhideCategory: vi.fn(),
}))

const MERCADO: Category = { id: 'cat-1', name: 'Mercado', kind: 'expense', isDefault: true, isHidden: false }
const GYM: Category = { id: 'cat-2', name: 'Gym', kind: 'expense', isDefault: true, isHidden: false }

describe('CategoryField', () => {
  beforeEach(() => {
    vi.mocked(listCategories).mockReset().mockResolvedValue([MERCADO, GYM])
    vi.mocked(createCategory).mockReset()
  })

  it('pide las categorias filtradas por el kind recibido', async () => {
    mount(CategoryField, { props: { modelValue: '', kind: 'expense' } })
    await flushPromises()

    expect(listCategories).toHaveBeenCalledWith('expense', false)
  })

  it('vuelve a pedir la lista cuando cambia el kind', async () => {
    const wrapper = mount(CategoryField, { props: { modelValue: '', kind: 'expense' } })
    await flushPromises()

    await wrapper.setProps({ kind: 'income' })
    await flushPromises()

    expect(listCategories).toHaveBeenCalledWith('income', false)
  })

  it('muestra las categorias como chips de sugerencia', async () => {
    const wrapper = mount(CategoryField, { props: { modelValue: '', kind: 'expense' } })
    await flushPromises()

    const chips = wrapper.findAll('.category-chip')
    expect(chips.map((chip) => chip.text())).toEqual(['Mercado', 'Gym'])
  })

  it('filtra las sugerencias segun lo escrito', async () => {
    // setProps (no input.setValue): CategoryField es un componente controlado -
    // el valor real lo dicta el padre via v-model, igual que cualquier otro
    // <input v-model> con getter/setter sobre una prop.
    const wrapper = mount(CategoryField, { props: { modelValue: '', kind: 'expense' } })
    await flushPromises()

    await wrapper.setProps({ modelValue: 'mer' })

    // "mer" no matchea EXACTO ninguna categoria existente, asi que ademas del
    // chip de sugerencia filtrado tambien aparece el de "+ Crear" - cubierto
    // aparte en su propio test.
    const suggestionChips = wrapper.findAll('.category-chip:not(.create)')
    expect(suggestionChips.map((chip) => chip.text())).toEqual(['Mercado'])
  })

  it('clickear un chip de sugerencia emite update:modelValue con ese nombre', async () => {
    const wrapper = mount(CategoryField, { props: { modelValue: '', kind: 'expense' } })
    await flushPromises()

    await wrapper.findAll('.category-chip')[0]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Mercado']])
  })

  it('sin texto que coincida, ofrece un chip para crear la categoria nueva', async () => {
    const wrapper = mount(CategoryField, { props: { modelValue: '', kind: 'expense' } })
    await flushPromises()

    await wrapper.setProps({ modelValue: 'Mascotas' })

    expect(wrapper.find('.category-chip.create').text()).toContain('Crear "Mascotas"')
  })

  it('si el texto ya coincide exactamente con una categoria existente, no ofrece crear', async () => {
    const wrapper = mount(CategoryField, { props: { modelValue: '', kind: 'expense' } })
    await flushPromises()

    await wrapper.setProps({ modelValue: 'Mercado' })

    expect(wrapper.find('.category-chip.create').exists()).toBe(false)
  })

  it('crear una categoria nueva la persiste y emite update:modelValue con el nombre creado', async () => {
    vi.mocked(createCategory).mockResolvedValue({ id: 'cat-3', name: 'Mascotas', kind: 'expense', isDefault: false, isHidden: false })
    const wrapper = mount(CategoryField, { props: { modelValue: '', kind: 'expense' } })
    await flushPromises()
    await wrapper.setProps({ modelValue: 'Mascotas' })

    await wrapper.find('.category-chip.create').trigger('click')
    await flushPromises()

    expect(createCategory).toHaveBeenCalledWith({ name: 'Mascotas', kind: 'expense' })
    expect(wrapper.emitted('update:modelValue')).toContainEqual(['Mascotas'])
  })
})
