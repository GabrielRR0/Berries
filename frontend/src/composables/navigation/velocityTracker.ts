// Velocidad de suelta de un gesto, medida solo sobre los ultimos ~100ms (mismo
// criterio que el VelocityTracker de Android) - promediar desde el inicio del
// gesto subestima un "flick" final rapido despues de un arrastre lento.
const WINDOW_MS = 100

interface Sample {
  t: number
  x: number
}

export function createVelocityTracker() {
  let samples: Sample[] = []

  function reset(t: number, x: number): void {
    samples = [{ t, x }]
  }

  function add(t: number, x: number): void {
    samples.push({ t, x })
    const cutoff = t - WINDOW_MS
    while (samples.length > 2 && samples[0].t < cutoff) samples.shift()
  }

  // px/ms, positivo hacia la derecha.
  function velocity(): number {
    if (samples.length < 2) return 0
    const first = samples[0]
    const last = samples[samples.length - 1]
    const dt = last.t - first.t
    return dt > 0 ? (last.x - first.x) / dt : 0
  }

  return { reset, add, velocity }
}
