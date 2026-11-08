<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePopTransition } from '../../animation/usePopTransition'
import { useStaggerReveal } from '../../animation/useStaggerReveal'
import { vPress } from '../../animation/vPress'
import { useScanBank } from '../../composables/screenshotScan/useScanBank'
import { getProfile } from '../../utils/screenshotScan/bankStatement'
import BottomSheet from '../ui/BottomSheet.vue'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'

// Pantalla "Banco de escaneo" (/ajustes/banco): elegir el banco cuyas capturas se van a leer. Cada banco
// tiene su propia forma de leerse (moneda, columnas, comisiones), asi que lo elegido decide las reglas con
// que Berry interpreta el estado de cuenta. Solo conecta: el estado y la persistencia viven en
// composables/screenshotScan/useScanBank.ts, los bancos en utils/screenshotScan/bankStatement/profiles/
// y los estilos en scanBankSettings.css.
const router = useRouter()
const { bankId, bankOptions, setBank } = useScanBank()
const pop = usePopTransition()

const pageRef = ref<HTMLElement | null>(null)
useStaggerReveal(pageRef, { spring: true, rise: 10, step: 0.05 })

const showHelpSheet = ref(false)

function goBack() {
  router.push({ name: 'ajustes' })
}
</script>

<template>
  <PageShell>
    <SectionHeader title="Banco de escaneo" max-width="62rem" @back="goBack" @help="showHelpSheet = true" />

    <div ref="pageRef" class="scan-bank">
      <section class="bank-choices" data-reveal>
        <h2 class="bank-section-title">Banco</h2>
        <p class="bank-section-hint">Elige el banco de las capturas que vas a subir. Define cómo se leen sus movimientos.</p>

        <div class="bank-list" role="radiogroup" aria-label="Banco de escaneo">
          <button
            v-for="option in bankOptions"
            :key="option.id"
            v-press="0.98"
            type="button"
            role="radio"
            class="bank-option"
            :class="{ 'is-selected': option.id === bankId }"
            :aria-checked="option.id === bankId"
            @click="setBank(option.id)"
          >
            <span class="bank-orb" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="bank-text">
              <span class="bank-label">{{ option.label }}</span>
              <span class="bank-description">{{ option.description }}</span>
            </span>
            <span class="bank-currency">{{ getProfile(option.id).currency }}</span>
            <span class="bank-check" aria-hidden="true">
              <Transition :css="false" @enter="pop.onEnter" @leave="pop.onLeave">
                <svg v-if="option.id === bankId" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </Transition>
            </span>
          </button>
        </div>
      </section>

      <section class="bank-info" data-reveal>
        <h2 class="bank-section-title">Qué cambia según el banco</h2>
        <ul class="bank-info-list">
          <li>La moneda de los movimientos.</li>
          <li>Cómo se escriben las cifras y de qué forma vienen las columnas.</li>
          <li>Cómo se unen las comisiones con su operación.</li>
        </ul>
        <p class="bank-note">
          Hoy solo está Banco de Venezuela, el único probado. Tu elección se guarda en este dispositivo; más adelante se
          guardará en tu cuenta.
        </p>
      </section>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Banco de escaneo?" @close="showHelpSheet = false">
      <p class="help-text">
        Cuando subes capturas de tu banco, Berry las lee con las reglas de ese banco. Aquí eliges cuál. Si tu banco no
        está en la lista, todavía no se puede leer con precisión.
      </p>
    </BottomSheet>
  </PageShell>
</template>

<style scoped src="./scanBankSettings.css"></style>
