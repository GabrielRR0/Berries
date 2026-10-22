<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCollapseTransition } from '../../animation/useCollapseTransition'
import { usePopTransition } from '../../animation/usePopTransition'
import { useStaggerReveal } from '../../animation/useStaggerReveal'
import { vPress } from '../../animation/vPress'
import { useAccentTheme } from '../../composables/theme/useAccentTheme'
import { DEFAULT_ACCENT_ID } from '../../utils/theme/accentPalettes'
import BottomSheet from '../ui/BottomSheet.vue'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'

// Pantalla "Apariencia" (/ajustes/color): elegir el color principal de la app.
// Elegir un color lo aplica al instante a TODA la app (fundido global, ver
// style.css) y la vista previa de arriba lo muestra en uso real. Solo conecta: el
// estado y la persistencia viven en composables/theme/useAccentTheme.ts, las
// paletas en utils/theme/accentPalettes.ts y los estilos en themeSettings.css.
const router = useRouter()
const { accentId, palette, palettes, setAccent } = useAccentTheme()
const pop = usePopTransition()
const collapse = useCollapseTransition()

const pageRef = ref<HTMLElement | null>(null)
useStaggerReveal(pageRef, { spring: true, rise: 10, step: 0.05 })

const showHelpSheet = ref(false)

function goBack() {
  router.push({ name: 'ajustes' })
}
</script>

<template>
  <PageShell>
    <SectionHeader title="Apariencia" max-width="62rem" @back="goBack" @help="showHelpSheet = true" />

    <div ref="pageRef" class="theme-settings">
      <!-- Vista previa: usa las mismas variables que el resto de la app, asi que
           se actualiza sola al elegir un color. -->
      <section class="theme-preview" data-reveal aria-label="Vista previa del color elegido">
        <div class="preview-top">
          <div>
            <p class="preview-label">Balance del mes</p>
            <p class="preview-amount">+$1,213.60</p>
          </div>
          <span class="preview-chip">{{ palette.label }}</span>
        </div>
        <div class="preview-bar" aria-hidden="true"><span class="preview-bar-fill" /></div>
        <div class="preview-tiles">
          <div class="preview-tile">
            <p class="preview-tile-label">Ingresos</p>
            <p class="preview-tile-amount">$2,340.00</p>
          </div>
          <div class="preview-tile expense">
            <p class="preview-tile-label">Gastos</p>
            <p class="preview-tile-amount">$1,126.40</p>
          </div>
        </div>
        <button type="button" class="preview-button" tabindex="-1">Nuevo movimiento</button>
      </section>

      <section class="theme-choices" data-reveal>
        <h2 class="theme-section-title">Color principal</h2>
        <p class="theme-section-hint">Toca un color y se aplica al instante en toda la app.</p>

        <div class="swatch-grid" role="radiogroup" aria-label="Color principal">
          <button
            v-for="option in palettes"
            :key="option.id"
            v-press="0.97"
            type="button"
            role="radio"
            class="swatch"
            :class="{ 'is-selected': option.id === accentId }"
            :aria-checked="option.id === accentId"
            :style="{ '--swatch': option.base, '--swatch-bright': option.bright }"
            @click="setAccent(option.id)"
          >
            <span class="swatch-orb" aria-hidden="true">
              <Transition :css="false" @enter="pop.onEnter" @leave="pop.onLeave">
                <svg v-if="option.id === accentId" class="swatch-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </Transition>
            </span>
            <span class="swatch-text">
              <span class="swatch-label">{{ option.label }}</span>
              <span class="swatch-description">{{ option.description }}</span>
            </span>
          </button>
        </div>

        <Transition :css="false" @enter="collapse.onEnter" @leave="collapse.onLeave">
          <button v-if="accentId !== DEFAULT_ACCENT_ID" type="button" class="reset-button" @click="setAccent(DEFAULT_ACCENT_ID)">
            Volver al rojo original
          </button>
        </Transition>
      </section>

      <p class="theme-note" data-reveal>
        Tu elección se guarda en este dispositivo. Más adelante se guardará en tu cuenta para que te acompañe en todos
        tus dispositivos.
      </p>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Apariencia?" @close="showHelpSheet = false">
      <p class="help-text">
        Elige el color principal de Berry: el de botones, barras, montos de gasto y detalles. Cambia al instante en toda
        la app. El rojo es el original.
      </p>
    </BottomSheet>
  </PageShell>
</template>

<style scoped src="./themeSettings.css"></style>
