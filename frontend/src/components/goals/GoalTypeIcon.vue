<script setup lang="ts">
import type { GoalType } from '../../services/goals/interfaces/goals.interface'

// Icono por plantilla de meta (ver goal_type en el backend) - un solo archivo con
// las 9 variantes en vez de 9 componentes sueltos, mismo criterio que los iconos
// inline de TransactionList.vue (rama v-if, sin libreria de iconos externa).
defineProps<{ type: GoalType }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path v-if="type === 'study'" d="M12 4 2 9l10 5 10-5-10-5ZM6 11.5V17c0 1.1 2.7 2 6 2s6-.9 6-2v-5.5" />
    <path v-else-if="type === 'business'" d="M4 10 5 4h14l1 6M4 10v9h16v-9M4 10h16M9 19v-5h6v5" />
    <path
      v-else-if="type === 'course'"
      d="M4 5.5c2-1 5-1 8 .5 3-1.5 6-1.5 8-.5v13c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5v-13ZM12 6v13"
    />
    <path v-else-if="type === 'housing'" d="M4 11 12 4l8 7M6 10v9h12v-9M10 19v-5h4v5" />
    <path
      v-else-if="type === 'travel'"
      d="m10.5 14-6 1.5 1.5-2.5-3-1.5 2-2 6 1L16 5c1-1 2.5-1 3 0s0 2-1 3l-4.5 5 1 6-2-2-1.5-3Z"
    />
    <path
      v-else-if="type === 'vehicle'"
      d="M4 16v-3l2-4.5A2 2 0 0 1 7.8 7h8.4a2 2 0 0 1 1.8 1.5L20 13v3M4 16h16M4 16v2h3v-2M17 16v2h3v-2M7 11h10"
    />
    <path
      v-else-if="type === 'computer'"
      d="M5 5h14v9H5V5ZM2 18.5h20L20 16H4l-2 2.5Z"
    />
    <path
      v-else-if="type === 'phone'"
      d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 19h2"
    />
    <path v-else d="M12 5v14M5 12h14" />
  </svg>
</template>
