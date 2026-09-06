<script setup lang="ts">
import { useOfflineQueueStore } from '../../stores/offlineQueue.store'
import BaseButton from '../ui/BaseButton.vue'
import PendingSyncCard from './PendingSyncCard.vue'

// Lee la cola directo del store (sin props) - mismo criterio que BalanceCard.vue
// con wallets.store. Se oculta por completo si no hay nada pendiente.
const offlineQueue = useOfflineQueueStore()

function onRetry(id: string) {
  offlineQueue.retry(id).catch(() => {})
}

function onDiscard(id: string) {
  offlineQueue.discard(id)
}

function onSyncAll() {
  offlineQueue.syncAll().catch(() => {})
}
</script>

<template>
  <section v-if="offlineQueue.items.length > 0" class="pending-sync-section">
    <div class="pending-sync-section-header">
      <h2 class="pending-sync-section-title">Pendientes de sincronizar</h2>
      <BaseButton type="button" variant="secondary" size="sm" @click="onSyncAll">Sincronizar todo</BaseButton>
    </div>

    <div class="pending-sync-section-list">
      <PendingSyncCard
        v-for="item in offlineQueue.items"
        :key="item.id"
        :item="item"
        @retry="onRetry"
        @discard="onDiscard"
      />
    </div>
  </section>
</template>

<style scoped>
.pending-sync-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pending-sync-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.pending-sync-section-title {
  font-size: 1rem;
  color: var(--text-h);
}

.pending-sync-section-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
