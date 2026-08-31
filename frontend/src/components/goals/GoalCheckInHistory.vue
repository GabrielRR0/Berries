<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listCheckIns } from '../../services/goals/goals.service'
import type { GoalCheckIn } from '../../services/goals/interfaces/goals.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import { formatDate } from '../../utils/formatters/formatDate'

// Historial de check-ins de UNA meta - carga perezosa (solo al abrir el
// detalle de una meta puntual, ver GoalsMain.vue), no se trae junto con la
// lista general de metas: sin esto, todo el trabajo de registrar
// postergaciones quedaria invisible para el usuario.
const props = defineProps<{ goalId: string; currency: string }>()

const checkIns = ref<GoalCheckIn[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    checkIns.value = await listCheckIns(props.goalId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo obtener el historial.'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="check-in-history">
    <p v-if="isLoading" class="check-in-history-status">Cargando historial...</p>
    <p v-else-if="error" class="check-in-history-status error">{{ error }}</p>
    <p v-else-if="checkIns.length === 0" class="check-in-history-status">Todavía no hay aportes registrados.</p>

    <ul v-else class="check-in-history-list">
      <li v-for="checkIn in checkIns" :key="checkIn.id" class="check-in-history-item">
        <div class="check-in-history-row">
          <span class="check-in-history-date">{{ formatDate(checkIn.createdAt) }}</span>
          <span class="check-in-history-amount">{{ formatCurrency(checkIn.amountSaved, currency) }}</span>
        </div>
        <p v-if="checkIn.newTargetDate" class="check-in-history-postponed">
          Meta pospuesta a {{ formatDate(checkIn.newTargetDate) }}
          <span v-if="checkIn.note">— {{ checkIn.note }}</span>
        </p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.check-in-history-status {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.check-in-history-status.error {
  color: var(--accent);
}

.check-in-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.check-in-history-item {
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--bg-inset);
}

.check-in-history-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.check-in-history-date {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.check-in-history-amount {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-h);
}

.check-in-history-postponed {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--accent);
  line-height: 1.4;
}
</style>
