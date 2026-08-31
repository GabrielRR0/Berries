<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAvatarInitials } from '../../composables/auth/useAvatarInitials'
import { useAuthStore } from '../../stores/auth.store'
import BottomSheet from '../ui/BottomSheet.vue'
import PageShell from '../layout/PageShell.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'

// Hub de "Ajustes" (reemplaza PlaceholderScreen.vue en esa ruta - ver
// router/index.ts, cambio reportado, no aplicado aca directo por los
// limites del trabajo): identidad del usuario logueado + navegacion real a
// Calculadora/Deudas/Categorías/Análisis + cerrar sesión. Sin features de ajustes propiamente
// dichas todavia (eso es otra pasada) - esto es solo la pega de navegacion.
// TopHeader/BottomTabBar ya no se montan aca, ver PageShell.vue.
const authStore = useAuthStore()
const router = useRouter()

const avatarInitials = useAvatarInitials()

const displayName = computed(() => authStore.user?.displayName || authStore.user?.email || 'Usuario')

async function onLogout() {
  authStore.logout()
  await router.push({ name: 'login' })
}

// Baja de cuenta autoservicio (pedido explicito: "eliminaar mi cuenta y no dejar
// rastro"). Confirmacion en dos pasos: primero un bottom sheet con la advertencia,
// despues escribir el propio correo exacto - mismo criterio que Github/Vercel para
// acciones irreversibles, mas fuerte que el confirm-inline de 2 pasos de WalletCard
// porque esto borra TODO (billeteras, movimientos, deudas, metas), no una sola fila.
const showDeleteSheet = ref(false)
const deleteConfirmationEmail = ref('')
const deleting = ref(false)
const deleteErrorMessage = ref('')

const canConfirmDelete = computed(
  () => !deleting.value && deleteConfirmationEmail.value.trim().toLowerCase() === authStore.user?.email?.toLowerCase(),
)

function openDeleteSheet() {
  deleteConfirmationEmail.value = ''
  deleteErrorMessage.value = ''
  showDeleteSheet.value = true
}

function closeDeleteSheet() {
  if (deleting.value) return
  showDeleteSheet.value = false
}

async function onDeleteAccount() {
  if (!canConfirmDelete.value) return
  deleteErrorMessage.value = ''
  deleting.value = true
  try {
    await authStore.deleteOwnAccount()
    await router.push({ name: 'login' })
  } catch (error) {
    deleteErrorMessage.value = error instanceof Error ? error.message : 'No se pudo eliminar la cuenta.'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <PageShell>
    <div class="settings-menu">
      <BaseCard class="profile-card">
        <span class="profile-avatar">{{ avatarInitials }}</span>
        <div class="profile-identity">
          <p class="profile-name">{{ displayName }}</p>
          <p v-if="authStore.user?.email" class="profile-email">{{ authStore.user.email }}</p>
        </div>
      </BaseCard>

      <nav class="menu-list" aria-label="Menú de ajustes">
        <RouterLink to="/calculadora" class="menu-item">
          <span class="menu-item-label">Calculadora</span>
          <span class="menu-item-arrow" aria-hidden="true">›</span>
        </RouterLink>

        <RouterLink to="/deudas" class="menu-item">
          <span class="menu-item-label">Deudas</span>
          <span class="menu-item-arrow" aria-hidden="true">›</span>
        </RouterLink>

        <RouterLink to="/metas" class="menu-item">
          <span class="menu-item-label">Metas</span>
          <span class="menu-item-arrow" aria-hidden="true">›</span>
        </RouterLink>

        <RouterLink to="/categorias" class="menu-item">
          <span class="menu-item-label">Categorías</span>
          <span class="menu-item-arrow" aria-hidden="true">›</span>
        </RouterLink>

        <RouterLink to="/analitica" class="menu-item">
          <span class="menu-item-label">Análisis</span>
          <span class="menu-item-arrow" aria-hidden="true">›</span>
        </RouterLink>
      </nav>

      <BaseButton variant="secondary" class="logout-button" @click="onLogout">Cerrar sesión</BaseButton>

      <div class="danger-zone">
        <p class="danger-zone-label">Zona de peligro</p>
        <button type="button" class="delete-account-trigger" @click="openDeleteSheet">Eliminar cuenta</button>
      </div>
    </div>

    <BottomSheet v-if="showDeleteSheet" title="Eliminar cuenta" @close="closeDeleteSheet">
      <p class="delete-warning">
        Esto borra tu cuenta y <strong>todo</strong> lo que tenga adentro - billeteras, movimientos, deudas y metas.
        No se puede deshacer.
      </p>

      <label class="field">
        <span class="field-label">Escribí tu correo ({{ authStore.user?.email }}) para confirmar</span>
        <input v-model="deleteConfirmationEmail" type="email" autocomplete="off" placeholder="tu@correo.com" />
      </label>

      <p v-if="deleteErrorMessage" class="delete-error" role="alert">{{ deleteErrorMessage }}</p>

      <div class="delete-sheet-actions">
        <BaseButton variant="secondary" :disabled="deleting" @click="closeDeleteSheet">Cancelar</BaseButton>
        <BaseButton class="delete-confirm-button" :disabled="!canConfirmDelete" @click="onDeleteAccount">
          {{ deleting ? 'Eliminando...' : 'Eliminar definitivamente' }}
        </BaseButton>
      </div>
    </BottomSheet>
  </PageShell>
</template>

<style scoped>
.settings-menu {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
  gap: 1.5rem;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.profile-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  color: var(--text-h);
  font-size: 1.125rem;
  font-weight: 700;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .profile-avatar {
    background: var(--bg-raised);
  }
}

.profile-identity {
  min-width: 0;
}

.profile-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-h);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-email {
  margin-top: 0.125rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-list {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  overflow: hidden;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .menu-list {
    background: var(--bg-surface);
  }
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  color: var(--text-h);
  text-decoration: none;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.menu-item:active {
  transform: scale(0.98);
}

.menu-item + .menu-item {
  border-top: 1px solid var(--border-subtle);
}

.menu-item:hover {
  background: var(--bg-raised);
}

.menu-item-label {
  font-size: 0.9375rem;
  font-weight: 600;
}

.menu-item-arrow {
  color: var(--text-muted);
  font-size: 1.125rem;
}

.logout-button {
  width: 100%;
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
}

.danger-zone-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.delete-account-trigger {
  align-self: flex-start;
  border: none;
  background: transparent;
  padding: 0;
  color: var(--accent);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.delete-account-trigger:hover {
  opacity: 0.8;
}

.delete-warning {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.delete-warning strong {
  color: var(--text-h);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.field input {
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field input:focus {
  outline: none;
  border-color: var(--accent);
}

.delete-sheet-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.delete-confirm-button {
  background: var(--accent);
  border-color: var(--accent);
}

.delete-error {
  margin-top: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

/* Sin grid aca, a diferencia del resto de las pantallas - deliberado: hoy
   es solo una card de perfil + 2 links + logout, sin contenido real que
   justifique multi-columna. Solo se ensancha un poco para no quedar como
   una columna angosta perdida en medio de una pantalla grande. */
@media (min-width: 1024px) {
  .settings-menu {
    max-width: 34rem;
  }
}

/* Animacion de entrada al cargar Ajustes en escritorio - bloque separado,
   guard extra de prefers-reduced-motion. Fill-mode "backwards" (nunca
   "both"/"forwards"): ver @keyframes content-enter en style.css. */
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .profile-card {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
  }

  .menu-list {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 50ms;
  }

  .logout-button {
    animation: content-enter var(--duration-base) var(--ease-out) backwards;
    animation-delay: 100ms;
  }
}
</style>
