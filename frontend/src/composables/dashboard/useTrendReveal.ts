// Estado a nivel de MODULO real (no dentro de un <script setup>, que Vue
// compila entero dentro de la funcion setup() de cada instancia - un `let`
// ahi se resetea en cada montaje, no sobrevive a que el componente se
// desmonte/remonte con cada visita a la ruta; confirmado con Playwright: el
// grafico volvia a "dibujarse" en cada cambio de pestaña rapido en vez de
// solo en visitas frescas). Mismo patron que usePageTransition.ts.
const REPLAY_THRESHOLD_MS = 5 * 60 * 1000
let lastRevealedAt = 0

// Solo true en visitas "frescas" a Inicio (login recien hecho, o volver
// despues de un rato) - pedido explicito del usuario, no en cada
// tab-switch rapido entre Movimientos/Inicio.
export function shouldPlayTrendReveal(): boolean {
  const now = Date.now()
  if (now - lastRevealedAt > REPLAY_THRESHOLD_MS) {
    lastRevealedAt = now
    return true
  }
  return false
}
