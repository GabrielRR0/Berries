// Formas publicas del dominio auth - lo que el resto de la app (stores,
// componentes) conoce y usa. La forma "sobre el cable" (UserWire/TokenWire)
// y los errores tipados (AuthApiError) son detalle de implementacion de
// auth.service.ts y se quedan ahi, no aca.
export interface AuthUser {
  id: string
  email: string
  displayName: string | null
  defaultCurrency: string
  createdAt: string
}

export interface AuthResult {
  accessToken: string
  tokenType: string
  user: AuthUser
}

// Una billetera a crear junto con la cuenta - ver RegisterWizard.vue paso 2.
export interface WalletSeed {
  name: string
  currency: string
  initialBalance: number
}
