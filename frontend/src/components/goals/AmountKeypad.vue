<script setup lang="ts">
// Teclado numerico reutilizable para ingresar un monto (paso 2 del alta de
// metas) - mismo lenguaje visual que las teclas de BasicCalculator.vue, pero
// mas simple (sin operadores, solo digitos + un punto decimal + borrar). El
// valor real vive en el padre (v-model de un string, no un numero - evita
// que "12." se convierta en "12" mientras el usuario todavia esta escribiendo
// el decimal).
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function pressDigit(digit: string) {
  if (props.modelValue === '0' && digit !== '.') {
    emit('update:modelValue', digit)
    return
  }
  emit('update:modelValue', props.modelValue + digit)
}

function pressDecimal() {
  if (props.modelValue.includes('.')) return
  emit('update:modelValue', props.modelValue === '' ? '0.' : `${props.modelValue}.`)
}

function pressBackspace() {
  emit('update:modelValue', props.modelValue.slice(0, -1))
}
</script>

<template>
  <div class="amount-keypad">
    <button type="button" class="key" @click="pressDigit('1')">1</button>
    <button type="button" class="key" @click="pressDigit('2')">2</button>
    <button type="button" class="key" @click="pressDigit('3')">3</button>
    <button type="button" class="key" @click="pressDigit('4')">4</button>
    <button type="button" class="key" @click="pressDigit('5')">5</button>
    <button type="button" class="key" @click="pressDigit('6')">6</button>
    <button type="button" class="key" @click="pressDigit('7')">7</button>
    <button type="button" class="key" @click="pressDigit('8')">8</button>
    <button type="button" class="key" @click="pressDigit('9')">9</button>
    <button type="button" class="key key-fn" @click="pressDecimal">.</button>
    <button type="button" class="key" @click="pressDigit('0')">0</button>
    <button type="button" class="key key-fn" @click="pressBackspace" aria-label="Borrar">⌫</button>
  </div>
</template>

<style scoped>
.amount-keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.625rem;
}

.key {
  padding: 0.875rem 0;
  border: none;
  border-radius: var(--radius-md);
  background: var(--bg-inset);
  color: var(--text-h);
  font: inherit;
  font-size: 1.25rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.key:hover {
  background: var(--bg-raised);
}

.key:active {
  transform: scale(0.94);
}

.key-fn {
  color: var(--accent);
}
</style>
