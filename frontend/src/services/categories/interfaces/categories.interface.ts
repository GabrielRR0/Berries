export type CategoryKind = 'income' | 'expense' | 'both'

export interface Category {
  id: string
  name: string
  kind: CategoryKind
  // true => por defecto (compartida, no borrable - solo ocultable). false => propia
  // del usuario (se puede editar/borrar libremente).
  isDefault: boolean
  // Solo relevante cuando se pidió con includeHidden=true (ver useCategories.ts) -
  // en cualquier otro caso siempre viene en false, ya que las ocultas ni se listan.
  isHidden: boolean
}

export interface CreateCategoryInput {
  name: string
  kind: CategoryKind
}
