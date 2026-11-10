<script setup lang="ts">
import { useFadeTransition } from '../../animation/useFadeTransition'
import BaseCard from '../ui/BaseCard.vue'
import SkeletonBlock from '../ui/SkeletonBlock.vue'

// Tarjeta de cada bloque de Analisis: titulo, acciones opcionales y un cuerpo que mientras
// no hay datos muestra un placeholder del MISMO alto (`minHeight`), asi cargar no mueve
// nada. Con datos viejos en pantalla (`refreshing`) el cuerpo se atenua un poco en vez de
// vaciarse.
withDefaults(
  defineProps<{ title: string; subtitle?: string; ready: boolean; refreshing?: boolean; minHeight?: string }>(),
  { subtitle: undefined, refreshing: false, minHeight: '16rem' },
)

const { onBeforeEnter, onEnter, onLeave } = useFadeTransition()
</script>

<template>
  <BaseCard class="analytics-card" :style="{ minHeight }">
    <header class="analytics-card-head">
      <div class="analytics-card-titles">
        <h2 class="analytics-card-title">{{ title }}</h2>
        <p v-if="subtitle" class="analytics-card-subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="analytics-card-actions"><slot name="actions" /></div>
    </header>

    <Transition :css="false" mode="out-in" @before-enter="onBeforeEnter" @enter="onEnter" @leave="onLeave">
      <div v-if="ready" key="content" class="analytics-card-body" :class="{ refreshing }" :aria-busy="refreshing">
        <slot />
      </div>
      <SkeletonBlock v-else key="skeleton" class="analytics-card-skeleton" />
    </Transition>
  </BaseCard>
</template>

<style scoped src="./analyticsCard.css"></style>
