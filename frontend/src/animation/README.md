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
   via `useSwipeToDismiss.ts`, y `useSectionPager.ts` via `useSwipeSettle.ts`).
2. Reemplazar cada uso por su equivalente en CSS (transition/@keyframes) o
   quitar el comportamiento si ya no hace falta.
3. Borrar la carpeta `src/animation/`.
4. `npm uninstall motion`.

## Uso actual

- `useSpringBack.ts` → usado por `useSwipeToDismiss.ts`: snap-back del panel
  al soltar el drag sin cruzar el umbral de cierre.
- `useSwipeToDismiss.ts` → `BottomSheet.vue`: estado + handlers del gesto de
  arrastrar hacia abajo para cerrar.
- `useSwipeSettle.ts` → `useSectionPager.ts` (composables/navigation/):
  resorte que asienta el paginador de secciones (Inicio/Movimientos/etc.) al
  soltar el dedo - hasta la pagina siguiente o de vuelta a 0 - arrancando con
  la velocidad real del gesto. Tunear la sensacion aca solo.

## Paginador de secciones (fuera de esta carpeta, para ubicarlo)

- `components/layout/SectionPager.vue` + `SectionPane.vue` + `sectionPager.css`:
  solo conectan.
- `composables/navigation/useSectionPager.ts`: estado, posiciones, sync con la ruta.
- `composables/navigation/useSectionSwipe.ts`: deteccion del gesto.
- `composables/navigation/useSectionComponents.ts`: precarga del codigo de cada seccion.
- `composables/navigation/velocityTracker.ts`: velocidad de suelta (ultimos ~100ms).
- `composables/navigation/sectionContext.ts`: scroll propio + "activa" para cada pagina.
