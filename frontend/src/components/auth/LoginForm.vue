<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.store'
import { isGoogleSignInEnabled } from '../../utils/google/googleAuthConfig'
import { isTurnstileEnabled } from '../../utils/turnstile/turnstileConfig'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import GoogleSignInButton from '../ui/GoogleSignInButton.vue'
import TurnstileWidget from '../ui/TurnstileWidget.vue'

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')

// Sin site key configurada, isTurnstileEnabled es false y TurnstileWidget no
// renderiza nada - no tiene sentido exigir un token que nunca va a llegar.
const turnstileToken = ref<string | null>(null)
const canSubmit = computed(() => !submitting.value && (!isTurnstileEnabled || turnstileToken.value !== null))

const authStore = useAuthStore()
const router = useRouter()

async function onSubmit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    await authStore.login(email.value, password.value, turnstileToken.value ?? undefined)
    await router.push({ name: 'dashboard' })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo iniciar sesión.'
    turnstileToken.value = null
  } finally {
    submitting.value = false
  }
}

// Si la cuenta de Google ya existe, loguea directo (como antes). Si es la primera vez
// (pedido explicito: "no solo le crea la cuenta sin el formulario tipo del registro"),
// todavia no se crea nada aca - se manda el credential a RegisterWizard.vue via el
// relay transitorio del store para que pase por el mismo wizard de billeteras/moneda
// que un registro por correo, en vez de arrancar la cuenta vacia en USD.
async function onGoogleCredential(idToken: string) {
  errorMessage.value = ''
  submitting.value = true
  try {
    const exists = await authStore.checkGoogleAccount(idToken)
    if (exists) {
      await authStore.loginWithGoogle(idToken)
      await router.push({ name: 'dashboard' })
    } else {
      authStore.setPendingGoogleIdToken(idToken)
      await router.push({ name: 'register' })
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-screen">
    <BaseCard class="auth-card">
      <p class="auth-wordmark">Berries</p>
      <h1 class="auth-title">Iniciar sesión</h1>
      <p class="auth-subtitle">Entra para ver tu balance y tus movimientos.</p>

      <GoogleSignInButton v-if="isGoogleSignInEnabled" class="google-button" @credential="onGoogleCredential" />
      <div v-if="isGoogleSignInEnabled" class="auth-divider"><span>o con tu correo</span></div>

      <form class="auth-form" @submit.prevent="onSubmit">
        <label class="field">
          <span class="field-label">Correo</span>
          <input v-model="email" type="email" required autocomplete="email" placeholder="tu@correo.com" />
        </label>

        <label class="field">
          <span class="field-label">Contraseña</span>
          <input v-model="password" type="password" required autocomplete="current-password" placeholder="••••••••" />
        </label>

        <TurnstileWidget @verified="turnstileToken = $event" @expired="turnstileToken = null" />

        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>

        <BaseButton type="submit" :disabled="!canSubmit" class="auth-submit">
          {{ submitting ? 'Ingresando...' : 'Iniciar sesión' }}
        </BaseButton>
      </form>

      <p class="auth-switch">
        ¿No tienes cuenta?
        <RouterLink to="/register">Crear cuenta</RouterLink>
      </p>
    </BaseCard>
  </div>
</template>

<style scoped>
.auth-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  min-height: 100vh;
  padding: 1.5rem;
  background-color: var(--bg);
  background-image: var(--hero-glow);
  background-repeat: no-repeat;
}

.auth-card {
  width: 100%;
  max-width: 23rem;
  animation: card-enter var(--duration-base) var(--ease-out) both;
}

.auth-wordmark {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.auth-title {
  margin-top: 0.5rem;
  font-size: 1.5rem;
}

.auth-subtitle {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.google-button {
  margin-top: 1.5rem;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.5rem;
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
  /* 1rem, no menos: evita el zoom automatico de iOS Safari al enfocar
     (se dispara por debajo de 16px). */
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field input:focus {
  outline: none;
  border-color: var(--accent);
}

.auth-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.auth-submit {
  width: 100%;
  margin-top: 0.25rem;
}

.auth-switch {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.auth-switch a {
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
}

.auth-switch a:hover {
  text-decoration: underline;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
