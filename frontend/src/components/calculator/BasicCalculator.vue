<script setup lang="ts">
import { reactive } from 'vue'
import {
  INITIAL_BASIC_CALCULATOR_STATE,
  pressBackspace,
  pressClear,
  pressDecimal,
  pressDigit,
  pressEquals,
  pressOperator,
  pressPercent,
  pressToggleSign,
} from '../../utils/calculator/basicCalculator'

// UI fina sobre el reducer puro de basicCalculator.ts (logica testeada por
// separado, sin montar este componente) - este archivo solo traduce clicks
// del teclado a llamadas del reducer y pinta el estado resultante.
const state = reactive({ ...INITIAL_BASIC_CALCULATOR_STATE })

function apply(next: typeof INITIAL_BASIC_CALCULATOR_STATE) {
  Object.assign(state, next)
}
</script>

<template>
  <div class="basic-calculator">
    <div class="display" :class="{ 'is-error': state.error }">
      <span class="display-pending" v-if="state.pendingOperator">
        {{ state.previousValue }} {{ state.pendingOperator }}
      </span>
      <span class="display-value">{{ state.display }}</span>
    </div>

    <div class="keypad">
      <button type="button" class="key key-fn" @click="apply(pressClear(state))">C</button>
      <button type="button" class="key key-fn" @click="apply(pressToggleSign(state))">+/−</button>
      <button type="button" class="key key-fn" @click="apply(pressPercent(state))">%</button>
      <button
        type="button"
        class="key key-op"
        :class="{ active: state.pendingOperator === '÷' }"
        @click="apply(pressOperator(state, '÷'))"
      >
        ÷
      </button>

      <button type="button" class="key" @click="apply(pressDigit(state, '7'))">7</button>
      <button type="button" class="key" @click="apply(pressDigit(state, '8'))">8</button>
      <button type="button" class="key" @click="apply(pressDigit(state, '9'))">9</button>
      <button
        type="button"
        class="key key-op"
        :class="{ active: state.pendingOperator === '×' }"
        @click="apply(pressOperator(state, '×'))"
      >
        ×
      </button>

      <button type="button" class="key" @click="apply(pressDigit(state, '4'))">4</button>
      <button type="button" class="key" @click="apply(pressDigit(state, '5'))">5</button>
      <button type="button" class="key" @click="apply(pressDigit(state, '6'))">6</button>
      <button
        type="button"
        class="key key-op"
        :class="{ active: state.pendingOperator === '-' }"
        @click="apply(pressOperator(state, '-'))"
      >
        −
      </button>

      <button type="button" class="key" @click="apply(pressDigit(state, '1'))">1</button>
      <button type="button" class="key" @click="apply(pressDigit(state, '2'))">2</button>
      <button type="button" class="key" @click="apply(pressDigit(state, '3'))">3</button>
      <button
        type="button"
        class="key key-op"
        :class="{ active: state.pendingOperator === '+' }"
        @click="apply(pressOperator(state, '+'))"
      >
        +
      </button>

      <button type="button" class="key key-backspace" aria-label="Borrar" @click="apply(pressBackspace(state))">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 5H5.5a1 1 0 0 0-.8.4L2 12l2.7 6.6a1 1 0 0 0 .8.4H21a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H9Z" stroke-linejoin="round" />
          <path d="m11 9 6 6M17 9l-6 6" stroke-linecap="round" />
        </svg>
      </button>
      <button type="button" class="key" @click="apply(pressDigit(state, '0'))">0</button>
      <button type="button" class="key" @click="apply(pressDecimal(state))">,</button>
      <button type="button" class="key key-equals" @click="apply(pressEquals(state))">=</button>
    </div>
  </div>
</template>

<style scoped>
.basic-calculator {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.display {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 0.25rem;
  min-height: 6rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
}

.display-pending {
  font-size: 0.9375rem;
  color: var(--text-muted);
}

.display-value {
  font-size: clamp(2rem, 9vw, 2.75rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-h);
  overflow-wrap: anywhere;
  text-align: right;
}

.display.is-error .display-value {
  color: var(--accent);
}

.keypad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.625rem;
}

.key {
  padding: 1.125rem 0;
  border: none;
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-h);
  font: inherit;
  font-size: 1.25rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

.key svg {
  width: 1.25rem;
  height: 1.25rem;
}

.key:hover {
  opacity: 0.9;
}

.key:active {
  transform: scale(0.94);
}

.key-fn {
  color: var(--text-muted);
  font-size: 1rem;
}

.key-op {
  color: var(--accent);
}

.key-op.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

.key-equals {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
}
</style>
