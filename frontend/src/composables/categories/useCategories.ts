import { ref } from 'vue'
import { fetchWithOfflineCache } from '../offline/useCachedFetch'
import {
  createCategory as createCategoryApi,
  deleteCategory as deleteCategoryApi,
  hideCategory as hideCategoryApi,
  listCategories as listCategoriesApi,
  unhideCategory as unhideCategoryApi,
} from '../../services/categories/categories.service'
import type { Category, CategoryKind, CreateCategoryInput } from '../../services/categories/interfaces/categories.interface'
import { useOfflineCachePreferencesStore } from '../../stores/offlineCachePreferences.store'

function cacheKeyFor(kind?: CategoryKind): string {
  return `berry_cache_categories_${kind ?? 'all'}`
}

// includeHidden: solo lo usa la pantalla de Ajustes (para poder restaurar una
// categoría por defecto que el usuario ocultó antes) - CategoryField.vue nunca lo
// pide, siempre quiere la lista ya filtrada de ocultas.

// Estado local de categorias (no un store de Pinia: se pide fresco cada vez que se
// necesita - crear/editar un movimiento, o la pantalla de Ajustes - en vez de
// mantenerse cacheado entre pantallas, mismo criterio que useDebts.ts/useGoals.ts).
export function useCategories() {
  const categories = ref<Category[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Recordado para saber como reaccionar a hide()/unhide(): CategoryField.vue pide
  // sin includeHidden (ocultar = la fila desaparece de las sugerencias), la pantalla
  // de Ajustes pide CON includeHidden (ocultar solo cambia isHidden en el lugar, para
  // poder restaurarla ahi mismo sin volver a pedir la lista).
  let lastIncludeHidden = false

  function toMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback
  }

  async function fetchCategories(kind?: CategoryKind, includeHidden = false): Promise<void> {
    lastIncludeHidden = includeHidden
    isLoading.value = true
    error.value = null
    await fetchWithOfflineCache<Category[]>({
      // La variante con ocultas (pantalla de Ajustes, para restaurar una
      // categoria) no se cachea - administrar categorias ocultas ya
      // requiere conexion para las mutaciones, y CategoryField.vue (que si
      // necesita esto offline) nunca pide includeHidden.
      isCachingEnabled: !includeHidden && useOfflineCachePreferencesStore().preferences.categories,
      cacheKey: cacheKeyFor(kind),
      fetchFn: () => listCategoriesApi(kind, includeHidden),
      onSuccess: (data) => {
        categories.value = data
      },
      onCacheFallback: (data) => {
        if (categories.value.length === 0) categories.value = data
      },
      onRealError: (message) => {
        error.value = message
      },
    }).catch(() => {})
    isLoading.value = false
  }

  async function create(input: CreateCategoryInput): Promise<Category> {
    error.value = null
    try {
      const category = await createCategoryApi(input)
      categories.value = [...categories.value, category].sort((a, b) => a.name.localeCompare(b.name))
      return category
    } catch (err) {
      error.value = toMessage(err, 'No se pudo crear la categoría.')
      throw err
    }
  }

  async function remove(categoryId: string): Promise<void> {
    error.value = null
    try {
      await deleteCategoryApi(categoryId)
      categories.value = categories.value.filter((category) => category.id !== categoryId)
    } catch (err) {
      error.value = toMessage(err, 'No se pudo eliminar la categoría.')
      throw err
    }
  }

  async function hide(categoryId: string): Promise<void> {
    error.value = null
    try {
      await hideCategoryApi(categoryId)
      if (lastIncludeHidden) {
        categories.value = categories.value.map((category) =>
          category.id === categoryId ? { ...category, isHidden: true } : category,
        )
      } else {
        categories.value = categories.value.filter((category) => category.id !== categoryId)
      }
    } catch (err) {
      error.value = toMessage(err, 'No se pudo ocultar la categoría.')
      throw err
    }
  }

  async function unhide(categoryId: string): Promise<void> {
    error.value = null
    try {
      await unhideCategoryApi(categoryId)
      categories.value = categories.value.map((category) =>
        category.id === categoryId ? { ...category, isHidden: false } : category,
      )
    } catch (err) {
      error.value = toMessage(err, 'No se pudo restaurar la categoría.')
      throw err
    }
  }

  return { categories, isLoading, error, fetchCategories, create, remove, hide, unhide }
}
