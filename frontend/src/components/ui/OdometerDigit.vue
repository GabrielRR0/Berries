<script setup lang="ts">
// Un solo "reel" de digito (0-9) tipo odometro/reloj mecanico antiguo -
// pedido explicito del usuario: no queria un numero que solo suma rapido,
// sino cada digito deslizandose hasta asentarse en su lugar. Pieza chica y
// generica (components/ui/), pensada para reusarse en cualquier monto de la
// app - ver AnimatedCurrency.vue, que es quien la usa.
defineProps<{ digit: number }>()
</script>

<template>
  <span class="odometer-digit">
    <span class="odometer-digit-track" :style="{ transform: `translateY(${-digit * 10}%)` }">
      <span v-for="n in 10" :key="n" class="odometer-digit-cell">{{ n - 1 }}</span>
    </span>
  </span>
</template>

<style scoped>
.odometer-digit {
  display: inline-block;
  position: relative;
  height: 1em;
  overflow: hidden;
  vertical-align: top;
  font-variant-numeric: tabular-nums;
}

.odometer-digit-track {
  display: flex;
  flex-direction: column;
  /* Curva propia (con un leve "overshoot"), no --ease-out/--ease-slide -
     pedido explicito del usuario ("una animacion... diferente a las
     demas"): un digito de odometro se siente mas mecanico/real si se pasa
     un poco antes de asentarse, en vez de frenar seco. */
  transition: transform 650ms var(--ease-odometer);
  will-change: transform;
}

.odometer-digit-cell {
  height: 1em;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (prefers-reduced-motion: reduce) {
  .odometer-digit-track {
    transition: none;
  }
}
</style>
