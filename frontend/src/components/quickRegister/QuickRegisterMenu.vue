<script setup lang="ts">
import IconBadge from '../ui/IconBadge.vue'

// Primer paso del panel "Registrar": como quiere cargar el movimiento. Tonto
// a proposito - solo emite la eleccion, QuickRegisterHost.vue decide que
// hacer con ella.
defineEmits<{ write: []; voice: []; receipt: []; captures: [] }>()
</script>

<template>
  <ul class="register-options">
    <li>
      <button type="button" class="register-option" @click="$emit('write')">
        <IconBadge shape="rounded" variant="accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 20h4L19 9l-4-4L4 16z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </IconBadge>
        <span class="register-option-text">
          <span class="register-option-title">Escribir</span>
          <span class="register-option-hint">Monto, categoría y cuenta</span>
        </span>
      </button>
    </li>
    <li>
      <button type="button" class="register-option" @click="$emit('voice')">
        <IconBadge shape="rounded">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke-linecap="round" />
          </svg>
        </IconBadge>
        <span class="register-option-text">
          <span class="register-option-title">Dictar por voz</span>
          <span class="register-option-hint">“Gasté 20 en el súper”</span>
        </span>
      </button>
    </li>
    <li>
      <button type="button" class="register-option" @click="$emit('receipt')">
        <IconBadge shape="rounded">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M4 8V6a2 2 0 0 1 2-2h2l1.5-1.5h5L16 4h2a2 2 0 0 1 2 2v2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <rect x="3" y="8" width="18" height="12" rx="2" />
            <circle cx="12" cy="14" r="3.25" />
          </svg>
        </IconBadge>
        <span class="register-option-text">
          <span class="register-option-title">Escanear recibo</span>
          <span class="register-option-hint">Toma o elige una foto</span>
        </span>
      </button>
    </li>
    <li>
      <button type="button" class="register-option" @click="$emit('captures')">
        <IconBadge shape="rounded">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 14l3-3 3 3 2-2 3 3" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="8.5" cy="8.5" r="1.25" />
          </svg>
        </IconBadge>
        <span class="register-option-text">
          <span class="register-option-title">Desde capturas</span>
          <span class="register-option-hint">Varios movimientos de tu banco a la vez</span>
        </span>
      </button>
    </li>
  </ul>
</template>

<style scoped src="./quickRegisterMenu.css"></style>
