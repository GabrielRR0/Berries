import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CategoriesApiError,
  createCategory,
  deleteCategory,
  hideCategory,
  listCategories,
  unhideCategory,
} from '../categories.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

const CATEGORY_WIRE = { id: 'cat-1', name: 'Mercado', kind: 'expense', is_default: true, is_hidden: false }

describe('categories.service', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('berry_auth_token', 'jwt-token')
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('listCategories', () => {
    it('sin argumentos, no manda ningun query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([CATEGORY_WIRE]))

      await listCategories()

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/categories')
    })

    it('con kind, lo manda como query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([CATEGORY_WIRE]))

      await listCategories('expense')

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/categories?kind=expense')
    })

    it('con includeHidden, lo manda como include_hidden=true', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([CATEGORY_WIRE]))

      await listCategories('expense', true)

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/categories?kind=expense&include_hidden=true')
    })

    it('mapea la respuesta snake_case a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([CATEGORY_WIRE]))

      const result = await listCategories()

      expect(result).toEqual([{ id: 'cat-1', name: 'Mercado', kind: 'expense', isDefault: true, isHidden: false }])
    })

    it('lanza CategoriesApiError con el status del backend en error', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'No autorizado' }, { ok: false, status: 401 }))

      const error: unknown = await listCategories().catch((e: unknown) => e)

      expect(error).toBeInstanceOf(CategoriesApiError)
      expect((error as CategoriesApiError).status).toBe(401)
    })
  })

  describe('createCategory', () => {
    it('manda name y kind, con el token en Authorization', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ id: 'cat-2', name: 'Mascotas', kind: 'expense', is_default: false, is_hidden: false }, { status: 201 }),
      )

      const result = await createCategory({ name: 'Mascotas', kind: 'expense' })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/categories')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer jwt-token' })
      expect(JSON.parse(init!.body as string)).toEqual({ name: 'Mascotas', kind: 'expense' })
      expect(result).toEqual({ id: 'cat-2', name: 'Mascotas', kind: 'expense', isDefault: false, isHidden: false })
    })

    it('lanza CategoriesApiError en 400 (validacion)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'El nombre no puede estar vacío' }, { ok: false, status: 400 }))

      const error: unknown = await createCategory({ name: '', kind: 'expense' }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(CategoriesApiError)
      expect((error as CategoriesApiError).status).toBe(400)
    })
  })

  describe('deleteCategory', () => {
    it('manda DELETE al endpoint del id', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { status: 204 }))

      await deleteCategory('cat-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/categories/cat-1')
      expect(init!.method).toBe('DELETE')
    })

    it('lanza CategoriesApiError en 409 (categoria por defecto)', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ detail: 'No se puede eliminar una categoría por defecto' }, { ok: false, status: 409 }),
      )

      const error: unknown = await deleteCategory('cat-1').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(CategoriesApiError)
      expect((error as CategoriesApiError).status).toBe(409)
    })
  })

  describe('hideCategory', () => {
    it('manda POST al endpoint de hide', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { status: 204 }))

      await hideCategory('cat-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/categories/cat-1/hide')
      expect(init!.method).toBe('POST')
    })
  })

  describe('unhideCategory', () => {
    it('manda DELETE al endpoint de hide', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { status: 204 }))

      await unhideCategory('cat-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/categories/cat-1/hide')
      expect(init!.method).toBe('DELETE')
    })
  })
})
