<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Wallet } from '../../services/wallets/interfaces/wallets.interface'
import { formatCurrency } from '../../utils/formatters/formatCurrency'
import type { RowAction, ScanRow } from '../../utils/screenshotScan/movementRows'
import CategoryField from '../transactions/CategoryField.vue'
import BaseCard from '../ui/BaseCard.vue'

// Una fila detectada en la captura: lo que se leyo (monto, descripcion, fecha),
// lo que se dedujo (gasto o recibido, comision, orden P2P enlazada) y los
// controles para decidir que hacer con ella. Lo que falta para poder
// registrarla se muestra en rojo debajo; el resto de los datos se editan en el
// panel que se abre con "Editar".
const props = defineProps<{ row: ScanRow; issues: string[]; wallets: Wallet[] }>()
const emit = defineEmits<{ update: [changes: Partial<ScanRow>] }>()

const editing = ref(false)

const currency = computed(() => props.row.currency ?? 'VEF')
const isIncoming = computed(() => props.row.direction === 'in')

// Una orden P2P suelta solo tiene sentido como transferencia (o se omite): no es un
// gasto ni un ingreso por si sola.
const actions = computed<{ value: RowAction; label: string }[]>(() => {
  if (props.row.source === 'p2p_order') {
    return [
      { value: 'transfer', label: 'Transferencia' },
      { value: 'skip', label: 'Omitir' },
    ]
  }
  return [
    { value: isIncoming.value ? 'income' : 'expense', label: isIncoming.value ? 'Recibido' : 'Gasto' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'skip', label: 'Omitir' },
  ]
})

const isSimple = computed(() => props.row.action === 'expense' || props.row.action === 'income')
const sentLabel = computed(() => (isIncoming.value ? 'Cuánto salió del origen' : 'Cuánto llegó al destino'))
const categoryKind = computed(() => (props.row.action === 'income' ? 'income' : 'expense'))

function set(changes: Partial<ScanRow>) {
  emit('update', changes)
}

function setDirection(direction: 'in' | 'out') {
  const isSimpleAction = props.row.action === 'expense' || props.row.action === 'income'
  set({
    direction,
    ...(isSimpleAction ? { action: direction === 'in' ? 'income' : 'expense' } : {}),
    // Cada tipo tiene sus propias categorias.
    category: '',
  })
}

function numberOrNull(event: Event): number | null {
  const value = (event.target as HTMLInputElement).valueAsNumber
  return Number.isFinite(value) ? value : null
}
</script>

<template>
  <BaseCard class="row-card" :class="{ 'row-card--skipped': row.action === 'skip', 'row-card--issue': issues.length > 0 }">
    <div class="row-top">
      <div class="row-main">
        <p class="row-description">{{ row.description || 'Movimiento' }}</p>
        <p class="row-meta">
          <span v-if="row.occurredOn">{{ row.occurredOn }}</span>
          <span v-if="row.time"> · {{ row.time }}</span>
          <span v-if="row.fee > 0"> · comisión {{ formatCurrency(row.fee, row.action === 'transfer' && row.p2p ? 'USDT' : currency) }}</span>
        </p>
      </div>
      <p class="row-amount" :class="{ 'row-amount--in': isIncoming }">
        {{ isIncoming ? '+' : '' }}{{ formatCurrency(row.amount, currency) }}
      </p>
    </div>

    <p v-if="row.p2p" class="row-note">
      Orden P2P: {{ row.p2p.usdt }} USDT<span v-if="row.p2p.counterparty"> · {{ row.p2p.counterparty }}</span>
    </p>
    <p v-else-if="row.sentAmount !== null && row.action === 'transfer'" class="row-note">
      {{ formatCurrency(row.sentAmount, 'USDT') }} enlazados
    </p>

    <ul v-if="row.flags.length > 0 && row.action !== 'skip'" class="row-flags">
      <li v-for="flag in row.flags" :key="flag">{{ flag }}</li>
    </ul>

    <div class="action-chips" role="tablist">
      <button
        v-for="action in actions"
        :key="action.value"
        type="button"
        class="action-chip"
        role="tab"
        :aria-selected="row.action === action.value"
        :class="{ active: row.action === action.value }"
        @click="set({ action: action.value })"
      >
        {{ action.label }}
      </button>
    </div>

    <ul v-if="issues.length > 0" class="row-issues" role="alert">
      <li v-for="issue in issues" :key="issue">{{ issue }}</li>
    </ul>

    <p v-if="row.action === 'skip'" class="row-skipped-note">No se registrará. Elige otra opción para incluirla.</p>

    <button
      v-if="row.action !== 'skip'"
      type="button"
      class="edit-toggle"
      :class="{ 'edit-toggle--quiet': issues.length === 0 }"
      :aria-expanded="editing"
      @click="editing = !editing"
    >
      {{ editing ? 'Cerrar' : issues.length > 0 ? 'Completar los datos que faltan' : 'Editar' }}
      <span aria-hidden="true">{{ editing ? '▴' : '▾' }}</span>
    </button>

    <div v-if="editing && row.action !== 'skip'" class="row-editor">
      <label v-if="row.source === 'bank'" class="field">
        <span class="field-label">Tipo</span>
        <select :value="row.direction" @change="setDirection(($event.target as HTMLSelectElement).value as 'in' | 'out')">
          <option value="out">Gasto (salió dinero)</option>
          <option value="in">Recibido (entró dinero)</option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">Monto ({{ currency }})</span>
        <input :value="row.amount" type="number" min="0.01" step="0.01" @input="set({ amount: numberOrNull($event) ?? 0 })" />
      </label>

      <label class="field">
        <span class="field-label">Fecha</span>
        <input
          :value="row.occurredOn ?? ''"
          type="date"
          :class="{ 'is-missing': !row.occurredOn && row.action !== 'pending' }"
          @change="set({ occurredOn: ($event.target as HTMLInputElement).value || null })"
        />
      </label>

      <template v-if="row.action === 'transfer'">
        <label class="field">
          <span class="field-label">Desde</span>
          <select :value="row.fromWalletId" @change="set({ fromWalletId: ($event.target as HTMLSelectElement).value })">
            <option value="" disabled>Elige una billetera</option>
            <option v-for="wallet in wallets" :key="wallet.id" :value="wallet.id">{{ wallet.name }} ({{ wallet.currency }})</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Hacia</span>
          <select :value="row.toWalletId" @change="set({ toWalletId: ($event.target as HTMLSelectElement).value })">
            <option value="" disabled>Elige una billetera</option>
            <option v-for="wallet in wallets" :key="wallet.id" :value="wallet.id">{{ wallet.name }} ({{ wallet.currency }})</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">{{ sentLabel }}</span>
          <input
            :value="row.sentAmount ?? ''"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Si no lo sabes, déjalo pendiente"
            @input="set({ sentAmount: numberOrNull($event) })"
          />
        </label>
        <label class="field">
          <span class="field-label">Comisión (opcional)</span>
          <input :value="row.fee || ''" type="number" min="0" step="0.01" placeholder="0.00" @input="set({ fee: numberOrNull($event) ?? 0 })" />
        </label>
      </template>

      <template v-else>
        <label class="field">
          <span class="field-label">Billetera</span>
          <select :value="row.walletId" @change="set({ walletId: ($event.target as HTMLSelectElement).value })">
            <option value="" disabled>Elige una billetera</option>
            <option v-for="wallet in wallets" :key="wallet.id" :value="wallet.id">{{ wallet.name }} ({{ wallet.currency }})</option>
          </select>
        </label>

        <div v-if="isSimple || row.action === 'pending'" class="field" :class="{ 'field--missing': isSimple && row.category.trim() === '' }">
          <span class="field-label">Categoría{{ row.action === 'pending' ? ' (opcional)' : '' }}</span>
          <CategoryField :model-value="row.category" :kind="categoryKind" @update:model-value="set({ category: $event })" />
        </div>

        <label v-if="row.action === 'expense'" class="field">
          <span class="field-label">Comisión (opcional)</span>
          <input :value="row.fee || ''" type="number" min="0" step="0.01" placeholder="0.00" @input="set({ fee: numberOrNull($event) ?? 0 })" />
        </label>
      </template>

      <label class="field">
        <span class="field-label">Descripción</span>
        <input :value="row.description" type="text" @input="set({ description: ($event.target as HTMLInputElement).value })" />
      </label>
    </div>
  </BaseCard>
</template>

<style scoped>
.row-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Una fila omitida atenua solo su contenido: los botones de abajo siguen a todo color para
   que se vea que se puede cambiar de opcion o editar. */
.row-card--skipped .row-top,
.row-card--skipped .row-note {
  opacity: 0.5;
}

.row-skipped-note {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.row-card--issue {
  border-color: var(--accent-border);
}

.row-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.row-main {
  min-width: 0;
}

.row-description {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-h);
  overflow-wrap: anywhere;
}

.row-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.row-amount {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-h);
  white-space: nowrap;
}

.row-amount--in {
  color: var(--success, #4caf50);
}

.row-note {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.row-flags,
.row-issues {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.row-flags {
  color: var(--text-muted);
}

.row-issues {
  color: var(--accent);
  font-weight: 600;
}

.action-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.action-chip {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--glass-bg);
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.action-chip.active {
  background: var(--accent-muted);
  border-color: var(--accent-border);
  color: var(--accent);
  font-weight: 600;
}

/* Se ve como un boton (no como un texto suelto): es la accion principal cuando a la fila
   le falta algo. */
.edit-toggle {
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-sm);
  background: var(--accent-muted);
  color: var(--accent);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.edit-toggle:hover {
  opacity: 0.85;
}

.edit-toggle:active {
  transform: scale(0.98);
}

.edit-toggle--quiet {
  border-color: var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-h);
}

.row-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.field input,
.field select {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--accent);
}

.field--missing .field-label,
.is-missing {
  color: var(--accent);
  border-color: var(--accent);
}
</style>
