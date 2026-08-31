// Servicio fetch-based del dominio categories (mismo patron que
// services/debts/debts.service.ts): funciones planas, sin axios, que mapean
// la respuesta snake_case del backend a interfaces TS en camelCase. Cada
// funcion lee el token actual llamando useAuthStore() adentro suyo (nunca se
// cachea a nivel de modulo) y lo manda como Authorization: Bearer <token>.

import { useAuthStore } from '../../stores/auth.store'
import type { Category, CategoryKind, CreateCategoryInput } from './interfaces/categories.interface'

interface CategoryWire {
  id: string
  name: string
  kind: CategoryKind
  is_default: boolean
  is_hidden: boolean
}

export class CategoriesApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CategoriesApiError'
    this.status = status
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function mapCategory(wire: CategoryWire): Category {
  return { id: wire.id, name: wire.name, kind: wire.kind, isDefault: wire.is_default, isHidden: wire.is_hidden }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

function authHeaders(): Record<string, string> {
  const token = useAuthStore().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function listCategories(kind?: CategoryKind, includeHidden?: boolean): Promise<Category[]> {
  const params = new URLSearchParams()
  if (kind) params.set('kind', kind)
  if (includeHidden) params.set('include_hidden', 'true')
  const query = params.toString() ? `?${params.toString()}` : ''

  const response = await fetch(`${API_BASE_URL}/api/categories${query}`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new CategoriesApiError(await parseErrorMessage(response, 'No se pudieron obtener las categorías.'), response.status)
  }

  return ((await response.json()) as CategoryWire[]).map(mapCategory)
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name: input.name, kind: input.kind }),
  })

  if (!response.ok) {
    throw new CategoriesApiError(await parseErrorMessage(response, 'No se pudo crear la categoría.'), response.status)
  }

  return mapCategory((await response.json()) as CategoryWire)
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/categories/${categoryId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new CategoriesApiError(await parseErrorMessage(response, 'No se pudo eliminar la categoría.'), response.status)
  }
}

export async function hideCategory(categoryId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/categories/${categoryId}/hide`, {
    method: 'POST',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new CategoriesApiError(await parseErrorMessage(response, 'No se pudo ocultar la categoría.'), response.status)
  }
}

export async function unhideCategory(categoryId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/categories/${categoryId}/hide`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new CategoriesApiError(await parseErrorMessage(response, 'No se pudo restaurar la categoría.'), response.status)
  }
}
