// Fuente unica de si "Iniciar sesion con Google" esta activo del lado del frontend -
// mismo criterio que turnstileConfig.ts: sin Client ID configurada, GoogleSignInButton.vue
// no renderiza nada (nunca carga el script de Google) hasta que el usuario cree un
// proyecto real en Google Cloud Console.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
export const isGoogleSignInEnabled = GOOGLE_CLIENT_ID !== ''
