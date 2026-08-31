import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCategory,
  deleteCategory,
  hideCategory,
  listCategories,
  unhideCategory,
} from '../../../services/categories/categories.service'
import type { Category } from '../../../services/categories/interfaces/categories.interface'
import { useCategories } from '../useCategories'

vi.mock('../../../services/categories/categories.service', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  hideCategory: vi.fn(),
  unhideCategory: vi.fn(),
}))

const DEFAULT_CATEGORY: Category = { id: 'cat-1', name: 'Mercado', kind: 'expense', isDefault: true, isHidden: false }
const CUSTOM_CATEGORY: Category = { id: 'cat-2', name: 'Mascotas', kind: 'expense', isDefault: false, isHidden: false }

describe('useCategories', () => {
  beforeEach(() => {
    vi.mocked(listCategories).mockReset().mockResolvedValue([DEFAULT_CATEGORY])
    vi.mocked(createCategory).mockReset()
    vi.mocked(deleteCategory).mockReset()
    vi.mocked(hideCategory).mockReset()
    vi.mocked(unhideCategory).mockReset()
  })

  it('arranca vacio, sin cargar y sin error', () => {
    const { categories, isLoading, error } = useCategories()

    expect(categories.value).toEqual([])
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  describe('fetchCategories', () => {
    it('pide la lista y la guarda, pasando isLoading por true y de vuelta a false', async () => {
      const { categories, isLoading, fetchCategories } = useCategories()

      const promise = fetchCategories()
      expect(isLoading.value).toBe(true)
      await promise

      expect(listCategories).toHaveBeenCalledWith(undefined, false)
      expect(categories.value).toEqual([DEFAULT_CATEGORY])
      expect(isLoading.value).toBe(false)
    })

    it('pasa kind e includeHidden al servicio', async () => {
      const { fetchCategories } = useCategories()

      await fetchCategories('expense', true)

      expect(listCategories).toHaveBeenCalledWith('expense', true)
    })

    it('guarda el mensaje de error si el servicio falla', async () => {
      vi.mocked(listCategories).mockRejectedValue(new Error('fallo de red'))
      const { categories, error, fetchCategories } = useCategories()

      await fetchCategories()

      expect(error.value).toBe('fallo de red')
      expect(categories.value).toEqual([])
    })
  })

  describe('create', () => {
    it('agrega la categoria creada a la lista, ordenada por nombre', async () => {
      vi.mocked(createCategory).mockResolvedValue(CUSTOM_CATEGORY)
      const { categories, fetchCategories, create } = useCategories()
      await fetchCategories()

      await create({ name: 'Mascotas', kind: 'expense' })

      expect(categories.value.map((c) => c.name)).toEqual(['Mascotas', 'Mercado'])
    })

    it('propaga el error del servicio', async () => {
      vi.mocked(createCategory).mockRejectedValue(new Error('nombre invalido'))
      const { error, create } = useCategories()

      await expect(create({ name: '', kind: 'expense' })).rejects.toThrow('nombre invalido')
      expect(error.value).toBe('nombre invalido')
    })
  })

  describe('remove', () => {
    it('quita la categoria de la lista', async () => {
      vi.mocked(listCategories).mockResolvedValue([DEFAULT_CATEGORY, CUSTOM_CATEGORY])
      const { categories, fetchCategories, remove } = useCategories()
      await fetchCategories()

      await remove('cat-2')

      expect(deleteCategory).toHaveBeenCalledWith('cat-2')
      expect(categories.value).toEqual([DEFAULT_CATEGORY])
    })

    it('propaga el error del servicio (ej. categoria por defecto)', async () => {
      vi.mocked(deleteCategory).mockRejectedValue(new Error('no se puede eliminar'))
      const { error, remove } = useCategories()

      await expect(remove('cat-1')).rejects.toThrow('no se puede eliminar')
      expect(error.value).toBe('no se puede eliminar')
    })
  })

  describe('hide', () => {
    it('sin includeHidden activo, saca la categoria de la lista (modo CategoryField)', async () => {
      const { categories, fetchCategories, hide } = useCategories()
      await fetchCategories()

      await hide('cat-1')

      expect(hideCategory).toHaveBeenCalledWith('cat-1')
      expect(categories.value).toEqual([])
    })

    it('con includeHidden activo, mantiene la fila y marca isHidden (modo Ajustes)', async () => {
      const { categories, fetchCategories, hide } = useCategories()
      await fetchCategories(undefined, true)

      await hide('cat-1')

      expect(categories.value).toEqual([{ ...DEFAULT_CATEGORY, isHidden: true }])
    })
  })

  describe('unhide', () => {
    it('marca la categoria como no oculta', async () => {
      vi.mocked(listCategories).mockResolvedValue([{ ...DEFAULT_CATEGORY, isHidden: true }])
      const { categories, fetchCategories, unhide } = useCategories()
      await fetchCategories(undefined, true)

      await unhide('cat-1')

      expect(unhideCategory).toHaveBeenCalledWith('cat-1')
      expect(categories.value).toEqual([DEFAULT_CATEGORY])
    })

    it('propaga el error del servicio', async () => {
      vi.mocked(unhideCategory).mockRejectedValue(new Error('fallo'))
      const { error, unhide } = useCategories()

      await expect(unhide('cat-1')).rejects.toThrow('fallo')
      expect(error.value).toBe('fallo')
    })
  })
})
