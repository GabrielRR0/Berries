<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '../../composables/toast/useToast'
import type { ConfirmOutcome } from '../../composables/screenshotScan/useBulkCapture'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import BulkCaptureWizard from './BulkCaptureWizard.vue'

// Pantalla propia "/movimientos/captura": el registro desde capturas es una vista
// real (no un modal) que se recorre paso a paso, con la misma animacion tipo pagina
// que el resto de la app (usePageTransition.ts desliza por profundidad de ruta).
// Desde una billetera en Cuentas se entra con ?billetera=<id> para dejarla elegida.
const router = useRouter()
const route = useRoute()
const { showToast } = useToast()

const initialWalletId = typeof route.query.billetera === 'string' ? route.query.billetera : ''

function goBack() {
  router.push({ name: 'movimientos' })
}

function onDone(outcome: ConfirmOutcome) {
  const parts = [
    outcome.registered > 0 ? `${outcome.registered} registrados` : null,
    outcome.transfers > 0 ? `${outcome.transfers} transferencias` : null,
    outcome.pendings > 0 ? `${outcome.pendings} pendientes` : null,
  ].filter(Boolean)
  showToast(parts.length > 0 ? `Listo: ${parts.join(', ')}.` : 'Listo.', 'success')
  goBack()
}
</script>

<template>
  <PageShell hide-tab-bar>
    <SectionHeader title="Registro desde capturas" max-width="40rem" @back="goBack" />

    <div class="bulk-capture-view">
      <BulkCaptureWizard :initial-wallet-id="initialWalletId" @done="onDone" @cancel="goBack" />
    </div>
  </PageShell>
</template>

<style scoped>
.bulk-capture-view {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
}
</style>
