# src/animation/

Unico modulo de Berry que depende de una libreria externa de animacion
(`motion`, alias Motion One, ~4KB gzip). Aislado a proposito: el resto de la
app anima con CSS puro (`style.css`), siguiendo el DESIGN.md raiz del
portafolio, que permite Motion One como unica excepcion liviana para los
casos que CSS nativo no resuelve bien (fisica de resorte con velocidad
inicial, por ejemplo un swipe que se suelta a mitad de camino).

## Regla del modulo

Ningun otro archivo de la app hace `import ... from 'motion'` directamente.
Todo pasa por `motion.ts` (el unico punto de entrada a la libreria) y los
composables de esta carpeta (`useSpringBack.ts`, `useSwipeToDismiss.ts`,
`useSwipeSettle.ts`, etc.).

Regla de los componentes `.vue`: la logica de gesto/animacion no vive inline
en el componente. Cada pieza de animacion no trivial (estado del drag,
umbrales, fisica de resorte) es un composable propio aca adentro, y el
componente solo lo importa y conecta sus refs/handlers al template - asi se
puede borrar o reemplazar sin tocar el componente.

## Como desinstalar esto en el futuro

1. Buscar los usos: `grep -rl "from '.*animation" src/` (hoy: `BottomSheet.vue`
   via `useSwipeToDismiss.ts`, y `useSwipeNavigation.ts` via `useSwipeSettle.ts`).
2. Reemplazar cada uso por su equivalente en CSS (transition/@keyframes) o
   quitar el comportamiento si ya no hace falta.
3. Borrar la carpeta `src/animation/`.
4. `npm uninstall motion`.

## Uso actual

- `useSpringBack.ts` → usado por `useSwipeToDismiss.ts`: snap-back del panel
  al soltar el drag sin cruzar el umbral de cierre.
- `useSwipeToDismiss.ts` → `BottomSheet.vue`: estado + handlers del gesto de
  arrastrar hacia abajo para cerrar.
- `useSwipeSettle.ts` → `useSwipeNavigation.ts` (composables/navigation/):
  asienta el arrastre horizontal entre secciones (Inicio/Movimientos/etc.) al
  soltar - hasta el commit (cambia de pagina) o de vuelta a 0 (spring-back) -
  con una curva/duracion tuneables aca solo, sin tocar la deteccion del gesto.
