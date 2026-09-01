<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import BottomSheet from '../ui/BottomSheet.vue'
import PillToggle from '../ui/PillToggle.vue'
import BasicCalculator from './BasicCalculator.vue'
import InstallmentCalculator from './InstallmentCalculator.vue'
import PercentageCalculator from './PercentageCalculator.vue'

// Pantalla "Calculadora" (/calculadora) - antes un acceso rapido sin
// navegar ("proximamente", ver QuickActionsGrid.vue), pedido explicito del
// usuario de construirla "medio completa para finanzas": herramientas
// independientes entre si (ningun estado compartido cruza de una a otra al
// cambiar de modo), elegidas por el usuario de una lista de opciones -
// mismo criterio de header/estilo que Movimientos/Cuentas/Deudas
// (SectionHeader + ayuda). Ninguna pega a un endpoint nuevo del backend -
// es matematica pura client-side.
//
// El modo "conversor" (CurrencyConverterCalculator.vue) esta deshabilitado
// temporalmente a pedido explicito del usuario - el archivo queda intacto
// para reactivarlo despues, solo se saco de MODE_OPTIONS/el template.
type CalculatorMode = 'basica' | 'cuotas' | 'porcentaje'

const MODE_OPTIONS: { value: CalculatorMode; label: string }[] = [
  { value: 'basica', label: 'Básica' },
  { value: 'cuotas', label: 'Cuotas' },
  { value: 'porcentaje', label: 'Porcentaje' },
]

const router = useRouter()
const mode = ref<CalculatorMode>('basica')
const showHelpSheet = ref(false)

function goBack() {
  router.push({ name: 'dashboard' })
}
</script>

<template>
  <PageShell hide-tab-bar>
    <SectionHeader title="Calculadora" max-width="64rem" @back="goBack" @help="showHelpSheet = true" />

    <div class="calculator-screen">
      <PillToggle
        :options="MODE_OPTIONS"
        :model-value="mode"
        @update:model-value="mode = $event as CalculatorMode"
      />

      <div class="calculator-panel">
        <BasicCalculator v-if="mode === 'basica'" />
        <InstallmentCalculator v-else-if="mode === 'cuotas'" />
        <PercentageCalculator v-else />
      </div>
    </div>

    <BottomSheet v-if="showHelpSheet" title="¿Qué es Calculadora?" @close="showHelpSheet = false">
      <p class="help-text">
        Herramientas para cuentas rápidas de todos los días: una calculadora básica, una simulación de cuotas para
        planear una deuda antes de cargarla, y dos cuentas de porcentaje (propinas, o qué parte representa un gasto de
        un total). Ninguna toca tus movimientos ni billeteras reales - son solo cuentas.
      </p>
    </BottomSheet>
  </PageShell>
</template>

<style scoped>
.calculator-screen {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 30rem;
  margin: 0 auto;
}

.calculator-panel {
  min-height: 0;
}

@media (min-width: 1024px) {
  .calculator-screen {
    max-width: 34rem;
  }
}
</style>
