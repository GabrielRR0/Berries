<script setup lang="ts">
import { useRouter } from 'vue-router'

// Botón que abre la vista "Registro desde capturas". Desde una billetera se pasa su
// id para que llegue elegida.
const props = defineProps<{ walletId?: string }>()
const router = useRouter()

function open() {
  router.push({ name: 'movimientos-captura', query: props.walletId ? { billetera: props.walletId } : {} })
}
</script>

<template>
  <button
    type="button"
    class="capture-trigger"
    aria-label="Registrar movimientos desde capturas"
    title="Registrar movimientos desde capturas"
    @click="open"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 14l3-3 3 3 2-2 3 3" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.25" />
    </svg>
  </button>
</template>

<style scoped>
.capture-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  color: var(--text-h);
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .capture-trigger {
    background: var(--bg-raised);
  }
}

.capture-trigger svg {
  width: 1.125rem;
  height: 1.125rem;
}

.capture-trigger:hover {
  opacity: 0.85;
}

.capture-trigger:active {
  transform: scale(0.94);
}
</style>
