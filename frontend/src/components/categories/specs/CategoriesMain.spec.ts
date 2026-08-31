import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCategory,
  deleteCategory,
  hideCategory,
  listCategories,
  unhideCategory,
} from '../../../services/categories/categories.service'
import type { Category } from '../../../services/categories/interfaces/categories.interface'
import CategoriesMain from '../CategoriesMain.vue'

vi.mock('../../../services/categories/categories.service', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  hideCategory: vi.fn(),
  unhideCategory: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const SALARIO: Category = { id: 'cat-1', name: 'Salario', kind: 'income', isDefault: true, isHidden: false }
const MERCADO: Category = { id: 'cat-2', name: 'Mercado', kind: 'expense', isDefault: true, isHidden: false }
const MASCOTAS: Category = { id: 'cat-3', name: 'Mascotas', kind: 'expense', isDefault: false, isHidden: false }

describe('CategoriesMain', () => {
  beforeEach(() => {
    vi.mocked(listCategories).mockReset().mockResolvedValue([SALARIO, MERCADO, MASCOTAS])
    vi.mocked(createCategory).mockReset()
    vi.mocked(deleteCategory).mockReset()
    vi.mocked(hideCategory).mockReset()
    vi.mocked(unhideCategory).mockReset()
    setActivePinia(createPinia())
  })

  it('pide las categorias incluyendo las ocultas, para poder restaurarlas', async () => {
    mount(CategoriesMain)
    await flushPromises()

    expect(listCategories).toHaveBeenCalledWith(undefined, true)
  })

  it('separa las categorias en Ingresos y Gastos', async () => {
    const wrapper = mount(CategoriesMain)
    await flushPromises()

    const sections = wrapper.findAll('.category-section')
    expect(sections[0]!.text()).toContain('Salario')
    expect(sections[0]!.text()).not.toContain('Mercado')
    expect(sections[1]!.text()).toContain('Mercado')
    expect(sections[1]!.text()).toContain('Mascotas')
  })

  it('las categorias por defecto muestran la insignia y el boton Ocultar', async () => {
    const wrapper = mount(CategoriesMain)
    await flushPromises()

    const rows = wrapper.findAll('.category-row')
    const mercadoRow = rows.find((row) => row.text().includes('Mercado'))!
    expect(mercadoRow.find('.category-badge').text()).toBe('Por defecto')
    expect(mercadoRow.find('.category-action').text()).toBe('Ocultar')
  })

  it('las categorias propias no muestran insignia y ofrecen Eliminar', async () => {
    const wrapper = mount(CategoriesMain)
    await flushPromises()

    const rows = wrapper.findAll('.category-row')
    const mascotasRow = rows.find((row) => row.text().includes('Mascotas'))!
    expect(mascotasRow.find('.category-badge').exists()).toBe(false)
    expect(mascotasRow.find('.category-action').text()).toBe('Eliminar')
  })

  it('ocultar una categoria por defecto la marca como oculta en el lugar', async () => {
    const wrapper = mount(CategoriesMain)
    await flushPromises()

    const rows = wrapper.findAll('.category-row')
    const mercadoRow = rows.find((row) => row.text().includes('Mercado'))!
    await mercadoRow.find('.category-action').trigger('click')
    await flushPromises()

    expect(hideCategory).toHaveBeenCalledWith('cat-2')
    expect(wrapper.find('.category-name.hidden').text()).toBe('Mercado')
    expect(wrapper.text()).toContain('Restaurar')
  })

  it('eliminar una categoria propia la saca de la lista', async () => {
    const wrapper = mount(CategoriesMain)
    await flushPromises()

    const rows = wrapper.findAll('.category-row')
    const mascotasRow = rows.find((row) => row.text().includes('Mascotas'))!
    await mascotasRow.find('.category-action').trigger('click')
    await flushPromises()

    expect(deleteCategory).toHaveBeenCalledWith('cat-3')
    expect(wrapper.text()).not.toContain('Mascotas')
  })

  it('agregar una categoria nueva la crea con el tipo elegido', async () => {
    vi.mocked(createCategory).mockResolvedValue({ id: 'cat-4', name: 'Suscripciones', kind: 'expense', isDefault: false, isHidden: false })
    const wrapper = mount(CategoriesMain)
    await flushPromises()

    await wrapper.find('.add-category-form input').setValue('Suscripciones')
    await wrapper.find('.add-category-form').trigger('submit')
    await flushPromises()

    expect(createCategory).toHaveBeenCalledWith({ name: 'Suscripciones', kind: 'expense' })
    expect(wrapper.text()).toContain('Suscripciones')
  })

  it('cambiar el tipo a Ingreso antes de agregar crea la categoria como income', async () => {
    vi.mocked(createCategory).mockResolvedValue({ id: 'cat-5', name: 'Bono', kind: 'income', isDefault: false, isHidden: false })
    const wrapper = mount(CategoriesMain)
    await flushPromises()

    await wrapper.findAll('.kind-option').find((btn) => btn.text() === 'Ingreso')!.trigger('click')
    await wrapper.find('.add-category-form input').setValue('Bono')
    await wrapper.find('.add-category-form').trigger('submit')
    await flushPromises()

    expect(createCategory).toHaveBeenCalledWith({ name: 'Bono', kind: 'income' })
  })
})
