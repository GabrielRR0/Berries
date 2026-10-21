<script setup lang="ts">
import { ref, toRef } from 'vue'
import { provideSectionContext } from '../../composables/navigation/sectionContext'

// Una pagina del paginador: su propio contenedor de scroll + contexto
// (scroller/activa) para lo que tenga adentro. Ver useSectionPager.ts.
const props = defineProps<{ active: boolean }>()
const scrollerEl = ref<HTMLElement | null>(null)
provideSectionContext(scrollerEl, toRef(props, 'active'))
</script>

<template>
  <div class="section-pane" :inert="!active" :aria-hidden="!active">
    <div ref="scrollerEl" class="section-pane-scroller">
      <slot />
    </div>
  </div>
</template>
