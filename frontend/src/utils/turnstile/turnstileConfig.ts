// Fuente unica de si Turnstile esta activo del lado del frontend - misma logica que
// TURNSTILE_ENABLED en el backend (ver app/shared/turnstile.py): sin site key
// configurada, TurnstileWidget.vue no renderiza nada y ningun formulario exige un
// token antes de enviar, para no bloquear el registro/login mientras el usuario
// todavia no creo un widget real en Cloudflare.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''
export const isTurnstileEnabled = TURNSTILE_SITE_KEY !== ''
