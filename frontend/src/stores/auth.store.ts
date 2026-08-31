import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  AuthApiError,
  checkGoogleAccountExists,
  deleteAccount,
  fetchCurrentUser,
  googleLogin,
  loginUser,
  registerUser,
} from '../services/auth/auth.service'
import type { AuthUser, WalletSeed } from '../services/auth/interfaces/auth.interface'

// A diferencia de otros dominios (wallets, transactions, ...), que tendran
// composables/<dominio>/useX.ts envolviendo services/<dominio>/x.service.ts,
// auth no tiene una capa de composable separada: el store de Pinia ya cumple
// ese rol para estado genuinamente global (la sesion logueada), asi que
// llama directo al servicio y guarda el estado reactivo el mismo.
const TOKEN_STORAGE_KEY = 'berry_auth_token'

export const useAuthStore = defineStore('auth', () => {
  // Restaura el token guardado al crear el store (boot de la app / refresh
  // de pagina) - el usuario no se pierde solo por recargar. "user" arranca
  // vacio incluso con token presente; fetchMe() lo repuebla (ver App.vue).
  const token = ref<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY))
  const user = ref<AuthUser | null>(null)

  const isAuthenticated = computed(() => token.value !== null)

  function setSession(newToken: string, newUser: AuthUser) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken)
  }

  async function register(
    email: string,
    password: string,
    displayName?: string,
    defaultCurrency?: string,
    wallets?: WalletSeed[],
    turnstileToken?: string,
  ): Promise<void> {
    const result = await registerUser(email, password, displayName, defaultCurrency, wallets, turnstileToken)
    setSession(result.accessToken, result.user)
  }

  async function login(email: string, password: string, turnstileToken?: string): Promise<void> {
    const result = await loginUser(email, password, turnstileToken)
    setSession(result.accessToken, result.user)
  }

  async function loginWithGoogle(idToken: string, defaultCurrency?: string, wallets?: WalletSeed[]): Promise<void> {
    const result = await googleLogin(idToken, defaultCurrency, wallets)
    setSession(result.accessToken, result.user)
  }

  // Usado por LoginForm.vue para decidir, antes de crear nada, si "Continuar con
  // Google" debe loguear directo (cuenta existente) o mandar al wizard completo de
  // registro (cuenta nueva - ver pendingGoogleIdToken abajo).
  async function checkGoogleAccount(idToken: string): Promise<boolean> {
    return checkGoogleAccountExists(idToken)
  }

  // Relay transitorio (en memoria, nunca en localStorage - solo dura hasta que se
  // consuma o se recargue la pagina) para pasarle el credential de Google ya obtenido
  // por LoginForm.vue a RegisterWizard.vue cuando la cuenta todavia no existe: en vez
  // de duplicar el flujo de billeteras/moneda en dos componentes, Login manda al
  // usuario a /register con el token "en mano" y el wizard lo recoge en su propio
  // onMounted (ver consumePendingGoogleIdToken) para arrancar directo en el paso 2,
  // como si hubiera tocado el boton de Google ahi mismo.
  const pendingGoogleIdToken = ref<string | null>(null)

  function setPendingGoogleIdToken(idToken: string): void {
    pendingGoogleIdToken.value = idToken
  }

  function consumePendingGoogleIdToken(): string | null {
    const value = pendingGoogleIdToken.value
    pendingGoogleIdToken.value = null
    return value
  }

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }

  // Baja de cuenta autoservicio (pedido explicito del usuario: "no dejar rastro de mi
  // cuenta"). El backend borra la fila de User y todo lo que le pertenece en una sola
  // transaccion (ver account_deletion_service.py) - aca solo queda limpiar la sesion
  // local, igual que logout().
  async function deleteOwnAccount(): Promise<void> {
    if (!token.value) return
    await deleteAccount(token.value)
    logout()
  }

  // Usado al bootear la app cuando hay un token persistido pero "user"
  // todavia esta vacio (refresh de pagina) - repuebla el perfil sin pedir
  // login de nuevo. Si el token ya no es valido (401), limpia la sesion en
  // vez de dejar un token muerto que siga fallando en cada request futuro.
  async function fetchMe(): Promise<void> {
    if (!token.value) return
    try {
      user.value = await fetchCurrentUser(token.value)
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        logout()
      }
      throw error
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    register,
    login,
    loginWithGoogle,
    checkGoogleAccount,
    setPendingGoogleIdToken,
    consumePendingGoogleIdToken,
    logout,
    deleteOwnAccount,
    fetchMe,
  }
})
