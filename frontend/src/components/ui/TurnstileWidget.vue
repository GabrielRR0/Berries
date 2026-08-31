<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { TURNSTILE_SITE_KEY } from '../../utils/turnstile/turnstileConfig'

// Widget de Cloudflare Turnstile (anti-bot) para login/registro - pedido explicito
// del usuario. Sin VITE_TURNSTILE_SITE_KEY configurada (el usuario todavia no creo
// un widget real en Cloudflare) no renderiza nada y nunca carga el script externo -
// mismo criterio "apagado por default" que TURNSTILE_ENABLED del backend.
//
// Render EXPLICITO (turnstile.render, no el <div class="cf-turnstile"> implicito)
// para poder resetear/quitar el widget al desmontar el componente (ej. al volver de
// un paso del wizard a otro) sin dejarlo huerfano.
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    __berryTurnstileLoad?: () => void
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__berryTurnstileLoad&render=explicit'

const emit = defineEmits<{ verified: [token: string]; expired: []; error: [] }>()

const container = ref<HTMLElement | null>(null)
let widgetId: string | null = null

let scriptLoadPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve) => {
    window.__berryTurnstileLoad = resolve
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

function renderWidget() {
  if (!container.value || !window.turnstile) return
  widgetId = window.turnstile.render(container.value, {
    sitekey: TURNSTILE_SITE_KEY,
    callback: (token: string) => emit('verified', token),
    'expired-callback': () => emit('expired'),
    'error-callback': () => emit('error'),
  })
}

onMounted(async () => {
  if (!TURNSTILE_SITE_KEY) return
  await loadScript()
  renderWidget()
})

onUnmounted(() => {
  if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
})

function reset() {
  if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
}

defineExpose({ reset })
</script>

<template>
  <div v-if="TURNSTILE_SITE_KEY" ref="container" class="turnstile-widget"></div>
</template>

<style scoped>
.turnstile-widget {
  display: flex;
  justify-content: center;
}
</style>
