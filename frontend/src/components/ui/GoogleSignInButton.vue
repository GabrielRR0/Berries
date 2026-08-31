<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { GOOGLE_CLIENT_ID } from '../../utils/google/googleAuthConfig'

// Boton "Continuar con Google" (Google Identity Services) - pedido explicito del
// usuario como alternativa a correo/contraseña. Sin VITE_GOOGLE_CLIENT_ID configurada
// (todavia no se creo un proyecto real en Google Cloud Console) no renderiza nada y
// nunca carga el script externo - mismo criterio "apagado por default" que
// TurnstileWidget.vue/TURNSTILE_ENABLED.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          renderButton: (container: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

const emit = defineEmits<{ credential: [idToken: string] }>()

const container = ref<HTMLElement | null>(null)

let scriptLoadPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

function renderButton() {
  if (!container.value || !window.google) return
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response: { credential: string }) => emit('credential', response.credential),
  })
  window.google.accounts.id.renderButton(container.value, {
    theme: 'filled_black',
    size: 'large',
    width: 320,
    text: 'continue_with',
  })
}

onMounted(async () => {
  if (!GOOGLE_CLIENT_ID) return
  await loadScript()
  renderButton()
})
</script>

<template>
  <div v-if="GOOGLE_CLIENT_ID" ref="container" class="google-signin-button"></div>
</template>

<style scoped>
.google-signin-button {
  display: flex;
  justify-content: center;
}
</style>
