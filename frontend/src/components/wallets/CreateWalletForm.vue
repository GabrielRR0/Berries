<script setup lang="ts">
import { ref } from 'vue'
import { useWalletsStore } from '../../stores/wallets.store'
import { SUPPORTED_CURRENCIES } from '../../utils/currency/supportedCurrencies'
import BaseButton from '../ui/BaseButton.vue'
import BaseCard from '../ui/BaseCard.vue'

// Formulario inline simple (no modal) para crear una wallet - llama directo
// al wallets.store (mismo criterio que LoginForm/RegisterWizard con
// auth.store: el form maneja su propio submitting/error local, la mutacion
// de estado global vive en el store). WalletsMain.vue solo decide cuando
// mostrar/ocultar este form via el emit 'created'/'cancel'.
const emit = defineEmits<{ created: []; cancel: [] }>()

const name = ref('')
const currency = ref(SUPPORTED_CURRENCIES[0].code)
const initialBalance = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const walletsStore = useWalletsStore()

async function onSubmit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    const balance = Number(initialBalance.value)
    await walletsStore.addWallet(name.value.trim(), currency.value, Number.isFinite(balance) ? balance : undefined)
    emit('created')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo crear la billetera.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseCard class="create-wallet-form">
    <h2 class="form-title">Nueva billetera</h2>

    <form class="form-body" @submit.prevent="onSubmit">
      <label class="field">
        <span class="field-label">Nombre</span>
        <input v-model="name" type="text" required maxlength="120" placeholder="Ej. Efectivo" autofocus />
      </label>

      <label class="field">
        <span class="field-label">Moneda</span>
        <select v-model="currency">
          <option v-for="option in SUPPORTED_CURRENCIES" :key="option.code" :value="option.code">
            {{ option.code }} — {{ option.name }}
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">Cuánto tienes ahora (opcional)</span>
        <input v-model="initialBalance" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
      </label>

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

      <div class="form-actions">
        <BaseButton type="button" variant="secondary" size="sm" :disabled="submitting" @click="$emit('cancel')">
          Cancelar
        </BaseButton>
        <BaseButton type="submit" size="sm" :disabled="submitting || !name.trim()">
          {{ submitting ? 'Creando...' : 'Crear' }}
        </BaseButton>
      </div>
    </form>
  </BaseCard>
</template>

<style scoped>
.create-wallet-form {
  animation: form-enter var(--duration-base) var(--ease-out) both;
}

.form-title {
  font-size: 1rem;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
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
  padding: 0.75rem 0.875rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--accent);
}

.form-error {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-border);
  background: var(--accent-muted);
  color: var(--accent);
  font-size: 0.8125rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@keyframes form-enter {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
