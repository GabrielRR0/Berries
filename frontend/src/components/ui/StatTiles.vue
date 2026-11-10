<script setup lang="ts">
import type { StatTile } from '../../utils/wallets/overviewTiles'

// Rejilla de tarjetas de estadisticas (Cuentas y cartola): icono + etiqueta, valor grande y
// una linea de contexto. Siempre ocupa el mismo alto aunque el valor cambie (ver
// docs/layout-stability.md), asi cambiar de periodo no mueve nada. `compact` = siempre 2
// columnas (panel lateral de escritorio).
withDefaults(defineProps<{ tiles: StatTile[]; compact?: boolean }>(), { compact: false })
</script>

<template>
  <ul class="stat-tiles" :class="{ compact }">
    <li v-for="tile in tiles" :key="tile.id" class="stat-tile">
      <p class="stat-tile-label">
        <span class="stat-tile-icon" :class="tile.tone" aria-hidden="true">
          <svg v-if="tile.icon === 'swap'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M7 7h11m0 0-3.5-3.5M18 7l-3.5 3.5M17 17H6m0 0 3.5-3.5M6 17l3.5 3.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else-if="tile.icon === 'fee'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M14.5 9.5c-.4-.9-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2.1-.6-2.5-1.5M12 6.5V8m0 8v1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else-if="tile.icon === 'percent'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M18 6 6 18" stroke-linecap="round" />
            <circle cx="7.5" cy="7.5" r="2" />
            <circle cx="16.5" cy="16.5" r="2" />
          </svg>
          <svg v-else-if="tile.icon === 'in'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
            <path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else-if="tile.icon === 'out'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
            <path d="M12 5v14M6 13l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        {{ tile.label }}
      </p>
      <p class="stat-tile-value" :class="tile.tone">{{ tile.value }}</p>
      <p class="stat-tile-hint">{{ tile.hint }}</p>
    </li>
  </ul>
</template>

<style scoped src="./statTiles.css"></style>
