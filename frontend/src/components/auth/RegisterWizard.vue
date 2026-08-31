<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.store'
import type { WalletSeed } from '../../services/auth/interfaces/auth.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { SUPPORTED_CURRENCIES } from '../../utils/currency/supportedCurrencies'
import { isGoogleSignInEnabled } from '../../utils/google/googleAuthConfig'
import { isTurnstileEnabled } from '../../utils/turnstile/turnstileConfig'
import BaseButton from '../ui/BaseButton.vue'
import GoogleSignInButton from '../ui/GoogleSignInButton.vue'
import TurnstileWidget from '../ui/TurnstileWidget.vue'

// Registro en pasos (pedido explicito del usuario, mismo espiritu que
// CreateGoalWizard.vue): 1) cuenta (correo/clave/nombre, igual que el viejo
// RegisterForm.vue) 2) billeteras opcionales con las que arrancar (no "elegi
// tus monedas" - un flujo de "agregar billetera" repetible, se puede repetir
// la misma moneda con otro nombre, ej. dos billeteras en USD) 3) moneda
// principal, SOLO si las billeteras agregadas usan mas de una moneda -
// preguntada explicita, nunca inferida sola 4) resumen + crear cuenta.
// Ningun paso de billeteras es obligatorio: se puede terminar el registro
// sin agregar ninguna, igual que hoy.
//
// Sin BaseCard (pedido explicito del usuario, segunda vuelta): cada paso debe
// sentirse como su propia pagina de ancho completo que desliza a la
// siguiente/anterior - no una tarjeta chica centrada con un paso a paso
// adentro. El mecanismo de transicion (stepTransitionName + las mismas
// clases .slide-left-*/.slide-right-* de style.css) ya era identico al de
// CreateGoalWizard.vue; lo que cambia aca es solo el contenedor visual.
interface WalletDraft {
  name: string
  currency: string
  initialBalance: string
}

const router = useRouter()
const authStore = useAuthStore()

const step = ref<1 | 2 | 3 | 4>(1)

// Misma animacion "tipo pagina" que el resto de la app usa entre pasos (ver
// CreateGoalWizard.vue) - las mismas clases CSS globales .slide-left-*/
// .slide-right-* de style.css, aplicadas a mano ya que esto no navega por
// vue-router.
const stepTransitionName = ref<'slide-left' | 'slide-right'>('slide-left')
watch(step, (newStep, oldStep) => {
  stepTransitionName.value = newStep > oldStep ? 'slide-left' : 'slide-right'
})

// --- Paso 1: cuenta ---
const displayName = ref('')
const email = ref('')
const password = ref('')
const canProceedStep1 = computed(() => email.value.trim() !== '' && password.value.length >= 8)

function goToWallets() {
  if (canProceedStep1.value) step.value = 2
}

// "Continuar con Google" solo reemplaza los campos de correo/clave del paso
// 1 (Google ya los verifica) - el resto del wizard (billeteras, moneda
// principal, resumen) sigue igual que con el alta por correo/clave. La
// cuenta recien se crea en el submit final del paso 4 (onSubmit), pasando el
// idToken que Google ya entrego aca junto con lo que se haya armado en los
// pasos siguientes.
const usingGoogle = ref(false)
const googleIdToken = ref<string | null>(null)
const googleEmail = ref('')
const googleName = ref('')
const googleErrorMessage = ref('')

function decodeGoogleIdToken(idToken: string): { email?: string; name?: string } {
  try {
    const payload = idToken.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as { email?: string; name?: string }
  } catch {
    return {}
  }
}

function applyGoogleCredential(idToken: string) {
  googleErrorMessage.value = ''
  const claims = decodeGoogleIdToken(idToken)
  usingGoogle.value = true
  googleIdToken.value = idToken
  googleEmail.value = claims.email ?? ''
  googleName.value = claims.name ?? ''
  step.value = 2
}

function onGoogleCredential(idToken: string) {
  applyGoogleCredential(idToken)
}

// LoginForm.vue manda aca (via el relay transitorio del store, ver
// consumePendingGoogleIdToken) cuando alguien toco "Continuar con Google" en Login
// pero esa cuenta todavia no existe - en vez de crearla ahi mismo con USD y cero
// billeteras, se redirige a este wizard con el credential ya "en mano" para que pase
// por el mismo paso a paso que un registro por correo (pedido explicito del usuario).
onMounted(() => {
  const pendingIdToken = authStore.consumePendingGoogleIdToken()
  if (pendingIdToken) applyGoogleCredential(pendingIdToken)
})

// --- Paso 2: billeteras ---
const wallets = ref<WalletDraft[]>([])

function defaultNameFor(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.name ?? code
}

const draftCurrency = ref(SUPPORTED_CURRENCIES[0].code)
const draftName = ref(defaultNameFor(draftCurrency.value))
const draftBalance = ref('')
// Deja de auto-sugerir el nombre por moneda en cuanto el usuario escribe el
// suyo (ej. "Facebank") - un select de moneda no le pisa lo que ya tipeo.
const nameTouched = ref(false)

watch(draftCurrency, (code) => {
  if (!nameTouched.value) draftName.value = defaultNameFor(code)
})

function addWallet() {
  const name = draftName.value.trim() || defaultNameFor(draftCurrency.value)
  const parsedBalance = Number(draftBalance.value)
  const initialBalance = Number.isFinite(parsedBalance) && parsedBalance > 0 ? String(parsedBalance) : '0'

  wallets.value.push({ name, currency: draftCurrency.value, initialBalance })

  draftCurrency.value = SUPPORTED_CURRENCIES[0].code
  draftName.value = defaultNameFor(draftCurrency.value)
  draftBalance.value = ''
  nameTouched.value = false
}

function removeWallet(index: number) {
  wallets.value.splice(index, 1)
}

// --- Paso 3: moneda principal (solo si hace falta desambiguar) ---
const distinctCurrencies = computed(() => Array.from(new Set(wallets.value.map((w) => w.currency))))
const defaultCurrency = ref('USD')
watch(distinctCurrencies, (codes) => {
  if (codes.length > 0 && !codes.includes(defaultCurrency.value)) defaultCurrency.value = codes[0]
})

function continueFromWallets() {
  step.value = distinctCurrencies.value.length > 1 ? 3 : 4
}

function goBack() {
  // El paso 3 no existe si solo hay una moneda (o ninguna) entre las
  // billeteras agregadas - volver desde el resumen en ese caso vuelve
  // directo al paso 2, no a un paso 3 que nunca se mostro.
  if (step.value === 4 && distinctCurrencies.value.length <= 1) {
    step.value = 2
  } else {
    step.value -= 1
  }
  // Volver hasta el paso 1 descarta el credential de Google ya capturado -
  // si el usuario vuelve hasta ahi es para elegir de nuevo (Google u otra
  // vez correo/clave), no para reusar un token viejo.
  if (step.value === 1) {
    usingGoogle.value = false
    googleIdToken.value = null
  }
}

// --- Paso 4: resumen + submit ---
const submitting = ref(false)
const errorMessage = ref('')

// Sin site key configurada, isTurnstileEnabled es false y TurnstileWidget no
// renderiza nada - no tiene sentido exigir un token que nunca va a llegar.
const turnstileToken = ref<string | null>(null)
const canSubmit = computed(() => !submitting.value && (!isTurnstileEnabled || turnstileToken.value !== null))

const summaryEmail = computed(() => (usingGoogle.value ? googleEmail.value : email.value))
const summaryName = computed(() => (usingGoogle.value ? googleName.value : displayName.value))

async function onSubmit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    const seeds: WalletSeed[] = wallets.value.map((w) => ({
      name: w.name,
      currency: w.currency,
      initialBalance: Number(w.initialBalance) || 0,
    }))
    if (usingGoogle.value && googleIdToken.value) {
      await authStore.loginWithGoogle(googleIdToken.value, defaultCurrency.value, seeds)
    } else {
      await authStore.register(
        email.value,
        password.value,
        displayName.value || undefined,
        defaultCurrency.value,
        seeds,
        turnstileToken.value ?? undefined,
      )
    }
    await router.push({ name: 'dashboard' })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo crear la cuenta.'
    turnstileToken.value = null
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-screen">
    <div class="wizard-page">
      <p class="auth-wordmark">Berries</p>

      <div class="wizard-progress">
        <span v-for="n in 4" :key="n" class="wizard-progress-segment" :class="{ filled: n <= step }" />
      </div>

      <div class="wizard-steps-viewport">
        <Transition :name="stepTransitionName">
          <div v-if="step === 1" key="1" class="wizard-step">
            <h1 class="wizard-title">Crear cuenta</h1>
            <p class="wizard-subtitle">Beta cerrada - cupos limitados.</p>

            <GoogleSignInButton v-if="isGoogleSignInEnabled" @credential="onGoogleCredential" />
            <p v-if="googleErrorMessage" class="auth-error" role="alert">{{ googleErrorMessage }}</p>
            <div v-if="isGoogleSignInEnabled" class="auth-divider"><span>o con tu correo</span></div>

            <form class="auth-form" @submit.prevent="goToWallets">
              <label class="field">
                <span class="field-label">Nombre (opcional)</span>
                <input v-model="displayName" type="text" autocomplete="name" placeholder="¿Cómo te llamamos?" />
              </label>

              <label class="field">
                <span class="field-label">Correo</span>
                <input v-model="email" type="email" required autocomplete="email" placeholder="tu@correo.com" />
              </label>

              <label class="field">
                <span class="field-label">Contraseña</span>
                <input
                  v-model="password"
                  type="password"
                  required
                  minlength="8"
                  autocomplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                />
              </label>

              <BaseButton type="submit" :disabled="!canProceedStep1" class="wizard-next">Continuar</BaseButton>
            </form>

            <p class="auth-switch">
              ¿Ya tienes cuenta?
              <RouterLink to="/login">Iniciar sesión</RouterLink>
            </p>
          </div>

          <div v-else-if="step === 2" key="2" class="wizard-step">
            <button type="button" class="wizard-back" @click="goBack" aria-label="Atrás">←</button>

            <h2 class="wizard-title">Tus billeteras</h2>
            <p class="wizard-subtitle">
              Opcional - agrega las cuentas que ya tienes, con lo que tengas en cada una. Puedes saltear este paso.
            </p>

            <ul v-if="wallets.length > 0" class="wallet-draft-list">
              <li v-for="(w, i) in wallets" :key="i" class="wallet-draft-item">
                <div class="wallet-draft-info">
                  <span class="wallet-draft-name">{{ w.name }}</span>
                  <span class="wallet-draft-meta">
                    {{ w.currency }} · {{ formatCurrency(Number(w.initialBalance) || 0, w.currency) }}
                  </span>
                </div>
                <button type="button" class="wallet-draft-remove" aria-label="Quitar billetera" @click="removeWallet(i)">
                  ✕
                </button>
              </li>
            </ul>

            <div class="wallet-form">
              <label class="field">
                <span class="field-label">Moneda</span>
                <select v-model="draftCurrency">
                  <option v-for="option in SUPPORTED_CURRENCIES" :key="option.code" :value="option.code">
                    {{ option.code }} — {{ option.name }}
                  </option>
                </select>
              </label>

              <label class="field">
                <span class="field-label">Nombre de la billetera</span>
                <input v-model="draftName" type="text" maxlength="120" @input="nameTouched = true" />
              </label>

              <label class="field">
                <span class="field-label">Cuánto tienes ahora (opcional)</span>
                <input v-model="draftBalance" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
              </label>

              <BaseButton type="button" variant="secondary" class="wallet-add-button" @click="addWallet">
                + Agregar billetera
              </BaseButton>
            </div>

            <BaseButton class="wizard-next" @click="continueFromWallets">
              {{ wallets.length > 0 ? 'Continuar' : 'Saltear' }}
            </BaseButton>
          </div>

          <div v-else-if="step === 3" key="3" class="wizard-step">
            <button type="button" class="wizard-back" @click="goBack" aria-label="Atrás">←</button>

            <h2 class="wizard-title">¿Cuál es tu moneda principal?</h2>
            <p class="wizard-subtitle">La vamos a usar para mostrar tus resúmenes.</p>

            <div class="primary-currency-options">
              <button
                v-for="code in distinctCurrencies"
                :key="code"
                type="button"
                class="primary-currency-option"
                :class="{ active: defaultCurrency === code }"
                @click="defaultCurrency = code"
              >
                {{ code }}
              </button>
            </div>

            <BaseButton class="wizard-next" @click="step = 4">Continuar</BaseButton>
          </div>

          <div v-else key="4" class="wizard-step">
            <button type="button" class="wizard-back" @click="goBack" aria-label="Atrás">←</button>

            <h2 class="wizard-title">Todo listo</h2>
            <p class="wizard-subtitle">Verificá los detalles antes de crear tu cuenta</p>

            <dl class="summary-list">
              <div class="summary-row">
                <dt>Correo</dt>
                <dd>{{ summaryEmail }}</dd>
              </div>
              <div v-if="summaryName" class="summary-row">
                <dt>Nombre</dt>
                <dd>{{ summaryName }}</dd>
              </div>
              <div class="summary-row">
                <dt>Moneda principal</dt>
                <dd>{{ defaultCurrency }}</dd>
              </div>
            </dl>

            <ul v-if="wallets.length > 0" class="wallet-draft-list">
              <li v-for="(w, i) in wallets" :key="i" class="wallet-draft-item">
                <div class="wallet-draft-info">
                  <span class="wallet-draft-name">{{ w.name }}</span>
                  <span class="wallet-draft-meta">
                    {{ w.currency }} · {{ formatCurrency(Number(w.initialBalance) || 0, w.currency) }}
                  </span>
                </div>
              </li>
            </ul>
            <p v-else class="wizard-hint">Sin billeteras todavía - puedes agregar una desde "Cuentas" cuando quieras.</p>

            <TurnstileWidget @verified="turnstileToken = $event" @expired="turnstileToken = null" />

            <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>

            <BaseButton class="wizard-next" :disabled="!canSubmit" @click="onSubmit">
              {{ submitting ? 'Creando cuenta...' : 'Crear cuenta' }}
            </BaseButton>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Sin flex-centrado ni tarjeta: es una pagina de ancho completo, no una caja
   chica en el medio - misma logica que cualquier otra pantalla de la app
   (PageShell.vue), solo que sin header/tab-bar fijos porque todavia no hay
   sesion. Arranca desde arriba para que un paso largo (ej. la lista de
   billeteras del paso 2) pueda crecer y scrollear como una pagina real, en
   vez de quedar centrado verticalmente de forma rara. */
.auth-screen {
  min-height: 100dvh;
  min-height: 100vh;
  padding: 2rem 1.5rem 3rem;
  background-color: var(--bg);
  background-image: var(--hero-glow);
  background-repeat: no-repeat;
}

.wizard-page {
  width: 100%;
  max-width: 30rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.auth-wordmark {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.wizard-progress {
  display: flex;
  gap: 0.375rem;
}

.wizard-progress-segment {
  flex: 1;
  height: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--border-subtle);
  transition: background-color var(--duration-base) var(--ease-out);
}

.wizard-progress-segment.filled {
  background: var(--accent);
}

/* Mismo contrato que .wizard-steps-viewport en CreateGoalWizard.vue: position
   relative + overflow-x clip como contexto para que los pasos entrante/
   saliente (position:absolute durante la transicion) no se recorten mal. */
.wizard-steps-viewport {
  position: relative;
  overflow-x: clip;
}

.wizard-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.wizard-title {
  font-size: 1.375rem;
  color: var(--text-h);
}

.wizard-subtitle {
  margin-top: -0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.wizard-back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
  font-size: 1.125rem;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.wizard-back:hover {
  opacity: 0.85;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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

.field input,
.field select {
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--accent);
}

.wizard-next {
  width: 100%;
}

.auth-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.auth-switch {
  margin-top: 0.5rem;
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

.wallet-draft-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.wallet-draft-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--bg-inset);
}

.wallet-draft-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.wallet-draft-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-h);
}

.wallet-draft-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.wallet-draft-remove {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.wallet-draft-remove:hover {
  background: var(--border);
  color: var(--text-h);
}

.wallet-form {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0.875rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
}

.wallet-add-button {
  width: 100%;
}

.wizard-hint {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.primary-currency-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.primary-currency-option {
  padding: 0.625rem 1rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.primary-currency-option.active {
  border-color: var(--accent);
  background: var(--accent-muted);
  color: var(--accent);
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin: 0;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.summary-row dt {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.summary-row dd {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-h);
  text-align: right;
}
</style>
