<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOfflineQueueStore } from '../../stores/offlineQueue.store'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'
import PageShell from '../layout/PageShell.vue'
import SectionHeader from '../layout/SectionHeader.vue'
import PendingSyncCard from './PendingSyncCard.vue'

// Pantalla propia (/pendientes) para las acciones que quedaron encoladas sin
// conexion - antes vivia como una seccion embebida en Inicio, que solo se
// mostraba cuando habia items (y por eso pasaba desapercibida mientras la
// app seguia offline). Ahora es una pantalla dedicada, accesible desde Menú.
const router = useRouter()
const offlineQueue = useOfflineQueueStore()

const hasItems = computed(() => offlineQueue.items.length > 0)

function goBack() {
  router.push({ name: 'ajustes' })
}

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
  <PageShell>
    <SectionHeader title="Pendientes" max-width="30rem" @back="goBack" />

    <div class="pending-sync-screen">
      <div v-if="hasItems" class="pending-sync-toolbar">
        <p class="pending-sync-count">{{ offlineQueue.pendingCount }} pendiente{{ offlineQueue.pendingCount === 1 ? '' : 's' }}</p>
        <BaseButton type="button" variant="secondary" size="sm" @click="onSyncAll">Sincronizar todo</BaseButton>
      </div>

      <div v-if="hasItems" class="pending-sync-list">
        <PendingSyncCard
          v-for="item in offlineQueue.items"
          :key="item.id"
          :item="item"
          @retry="onRetry"
          @discard="onDiscard"
        />
      </div>

      <BaseCard v-else class="pending-sync-empty">
        <p class="pending-sync-empty-title">No tenés nada pendiente de sincronizar</p>
        <p class="pending-sync-empty-text">
          Las acciones que registres sin conexión van a aparecer acá hasta sincronizarse solas.
        </p>
      </BaseCard>
    </div>
  </PageShell>
</template>

<style scoped>
.pending-sync-screen {
  display: flex;
  flex-direction: column;
  max-width: 30rem;
  margin: 0 auto;
  gap: 0.75rem;
}

.pending-sync-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.pending-sync-count {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
}

.pending-sync-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pending-sync-empty {
  margin-top: 1rem;
  text-align: center;
  color: var(--text-muted);
}

.pending-sync-empty-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
}

.pending-sync-empty-text {
  margin-top: 0.375rem;
  font-size: 0.8125rem;
}
</style>
