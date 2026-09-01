<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCategories } from '../../composables/categories/useCategories'
import type { CategoryKind } from '../../services/categories/interfaces/categories.interface'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'

// Pantalla "Categorías" (/categorias, enlazada desde Ajustes) - pedido
// explicito del usuario de tener categorias fijas configurables: las por
// defecto (sembradas por la migracion 202608280003_seed_default_categories.py,
// ver category_service.py) nunca se pueden borrar, solo ocultar (quedan
// afuera de las sugerencias de CategoryField.vue pero siguen existiendo -
// "Restaurar" las trae de vuelta). Las que el usuario crea aca (o desde el
// "+ Crear" de CategoryField.vue) se pueden borrar libremente. Sin
// confirmacion en dos pasos para ocultar/eliminar (a diferencia de
// Deudas/Metas/Wallets): borrar una categoria no borra ni afecta ningun
// movimiento ya registrado (Transaction.category es texto libre, no una FK),
// asi que el riesgo real de una accion aca es bajo.
const router = useRouter()
const { categories, isLoading, error, fetchCategories, create, remove, hide, unhide } = useCategories()

function goBack() {
  router.push({ name: 'ajustes' })
}

onMounted(() => {
  fetchCategories(undefined, true)
})

const incomeCategories = computed(() =>
  categories.value.filter((category) => category.kind === 'income' || category.kind === 'both'),
)
const expenseCategories = computed(() =>
  categories.value.filter((category) => category.kind === 'expense' || category.kind === 'both'),
)

const newName = ref('')
const newKind = ref<CategoryKind>('expense')
const isSubmitting = ref(false)

async function onCreate() {
  const name = newName.value.trim()
  if (!name) return

  isSubmitting.value = true
  try {
    await create({ name, kind: newKind.value })
    newName.value = ''
  } catch {
    // El mensaje ya queda expuesto via el "error" reactivo del composable.
  } finally {
    isSubmitting.value = false
  }
}

async function onToggleHidden(categoryId: string, isHidden: boolean) {
  if (isHidden) await unhide(categoryId).catch(() => {})
  else await hide(categoryId).catch(() => {})
}

async function onDelete(categoryId: string) {
  await remove(categoryId).catch(() => {})
}
</script>

<template>
  <PageShell>
    <SectionHeader title="Categorías" max-width="40rem" @back="goBack" />

    <div class="categories-screen">
      <p class="categories-intro">
        Las categorías por defecto no se pueden eliminar, pero puedes ocultarlas si no las usas. Las que tú creaste se
        pueden eliminar cuando quieras.
      </p>

      <p v-if="error" class="categories-error" role="alert">{{ error }}</p>
      <Transition name="loading-fade">
        <LoadingIndicator v-if="isLoading" label="Cargando categorías..." />
      </Transition>

      <section class="category-section">
        <h2 class="section-title">Ingresos</h2>
        <BaseCard class="category-list">
          <div v-for="category in incomeCategories" :key="category.id" class="category-row">
            <span class="category-name" :class="{ hidden: category.isHidden }">{{ category.name }}</span>
            <span v-if="category.isDefault" class="category-badge">Por defecto</span>
            <button
              v-if="category.isDefault"
              type="button"
              class="category-action"
              @click="onToggleHidden(category.id, category.isHidden)"
            >
              {{ category.isHidden ? 'Restaurar' : 'Ocultar' }}
            </button>
            <button v-else type="button" class="category-action danger" @click="onDelete(category.id)">Eliminar</button>
          </div>
          <p v-if="incomeCategories.length === 0 && !isLoading" class="category-empty">Sin categorías de ingreso.</p>
        </BaseCard>
      </section>

      <section class="category-section">
        <h2 class="section-title">Gastos</h2>
        <BaseCard class="category-list">
          <div v-for="category in expenseCategories" :key="category.id" class="category-row">
            <span class="category-name" :class="{ hidden: category.isHidden }">{{ category.name }}</span>
            <span v-if="category.isDefault" class="category-badge">Por defecto</span>
            <button
              v-if="category.isDefault"
              type="button"
              class="category-action"
              @click="onToggleHidden(category.id, category.isHidden)"
            >
              {{ category.isHidden ? 'Restaurar' : 'Ocultar' }}
            </button>
            <button v-else type="button" class="category-action danger" @click="onDelete(category.id)">Eliminar</button>
          </div>
          <p v-if="expenseCategories.length === 0 && !isLoading" class="category-empty">Sin categorías de gasto.</p>
        </BaseCard>
      </section>

      <section class="category-section">
        <h2 class="section-title">Agregar categoría</h2>
        <BaseCard class="add-category-card">
          <form class="add-category-form" @submit.prevent="onCreate">
            <div class="add-category-kind">
              <button
                type="button"
                class="kind-option"
                :class="{ active: newKind === 'expense' }"
                @click="newKind = 'expense'"
              >
                Gasto
              </button>
              <button
                type="button"
                class="kind-option"
                :class="{ active: newKind === 'income' }"
                @click="newKind = 'income'"
              >
                Ingreso
              </button>
            </div>
            <input v-model="newName" type="text" maxlength="80" placeholder="Ej. Mascotas" required />
            <BaseButton type="submit" size="sm" :disabled="isSubmitting">
              {{ isSubmitting ? 'Agregando...' : 'Agregar' }}
            </BaseButton>
          </form>
        </BaseCard>
      </section>
    </div>
  </PageShell>
</template>

<style scoped>
.categories-screen {
  display: flex;
  flex-direction: column;
  max-width: 34rem;
  margin: 0 auto;
  gap: 1.5rem;
}

.categories-intro {
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.categories-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.category-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  font-size: 1rem;
}

.category-list {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1.125rem;
}

.category-row + .category-row {
  border-top: 1px solid var(--border-subtle);
}

.category-name {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-name.hidden {
  color: var(--text-muted);
  font-weight: 500;
  text-decoration: line-through;
}

.category-badge {
  flex-shrink: 0;
  padding: 0.1875rem 0.5rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 600;
}

.category-action {
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out);
}

.category-action:hover {
  color: var(--text-h);
}

.category-action.danger:hover {
  color: var(--accent);
}

.category-empty {
  padding: 0.875rem 1.125rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.add-category-card {
  padding: 1rem 1.125rem;
}

.add-category-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.add-category-kind {
  display: inline-flex;
  align-self: flex-start;
  gap: 0.375rem;
  padding: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}

.kind-option {
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.kind-option.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

.add-category-form input {
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.add-category-form input:focus {
  outline: none;
  border-color: var(--accent);
}

.add-category-form :deep(.base-button) {
  align-self: flex-end;
}
</style>
