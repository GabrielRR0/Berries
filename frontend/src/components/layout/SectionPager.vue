<script setup lang="ts">
import { ref } from 'vue'
import { useSectionPager } from '../../composables/navigation/useSectionPager'
import { useSectionSwipe } from '../../composables/navigation/useSectionSwipe'
import LoadingIndicator from '../ui/LoadingIndicator.vue'
import SectionPane from './SectionPane.vue'

// Solo conecta: estado/animacion en useSectionPager.ts, gesto en
// useSectionSwipe.ts, estilos en sectionPager.css.
const rootEl = ref<HTMLElement | null>(null)
const pager = useSectionPager(rootEl)
useSectionSwipe(rootEl, pager)
const { sections, resolved, mountedIndices, isOnSection, isMoving, paneStyle, isPaneActive } = pager
</script>

<template>
  <div
    ref="rootEl"
    class="section-pager"
    :class="{ 'is-moving': isMoving }"
    :inert="!isOnSection"
  >
    <template v-for="(section, index) in sections" :key="section.name">
      <SectionPane v-if="mountedIndices.has(index)" :active="isPaneActive(index)" :style="paneStyle(index)">
        <component :is="resolved.get(section.name)" v-if="resolved.has(section.name)" />
        <div v-else class="section-pane-placeholder">
          <LoadingIndicator />
        </div>
      </SectionPane>
    </template>
  </div>
</template>

<style src="./sectionPager.css"></style>
