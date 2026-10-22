# Estabilidad de layout (sin saltos al cargar)

Reglas para que una pantalla no "brinque" cuando llegan los datos. Salieron de
un bug real en Movimientos (rediseño): la pantalla se movía varias veces al
cargar y el header se veía desalineado en escritorio.

## Reglas

1. **Reservar el espacio de lo que llega async.** Un bloque que depende de datos
   del servidor (barra de progreso, frase de resumen, filas, avisos) se renderiza
   siempre, con un estado vacío del mismo alto. Nunca `v-if="datos > 0"` sobre
   algo que cambie el alto de una tarjeta que está arriba del contenido.
   Ejemplo: `MonthSummaryCards.vue` muestra siempre barra + frase ("Sin ingresos
   registrados este mes" si no hay ingresos).
2. **Lo que aparece o desaparece solo se anima, no salta.** Un bloque que entra
   después de cargar (aviso de pendientes, panel de categorías) usa
   `<Transition :css="false">` con `useCollapseTransition()`
   (`src/animation/`): anima alto + padding, así el resto se desliza en vez de
   dar un golpe.
3. **El scrollbar no puede cambiar el ancho.** En escritorio `html` tiene
   `scrollbar-gutter: stable` (`style.css`); sin eso, el scrollbar que aparece al
   crecer la página corre todo el contenido ~8px.
4. **Elementos `position: fixed` que se alinean con una columna centrada usan `%`,
   no `100vw`.** `100vw` incluye el scrollbar, `100%` de un fixed no: con `100vw`
   el header queda ~8px desalineado (ver `SectionHeader.vue`).
5. **Animaciones de entrada con Motion, no con `@keyframes` por breakpoint.**
   Usar `useStaggerReveal` + `data-reveal` y los hooks de `src/animation/`. Un
   `transform` residual rompe a los `position: fixed` descendientes: los hooks ya
   limpian el estilo inline al terminar, mantener eso en los nuevos.
6. **Responsive en tres tramos** (<640, 640–1023, ≥1024) y también 320px. Probar
   en 320, 390, 700, 1024 y 1360 antes de dar una pantalla por terminada.

7. **Todo lo que aparece o desaparece se anima** (nunca `v-if` seco): bloques que
   ocupan espacio -> `useCollapseTransition`; bloques que reemplazan a otro ->
   `useFadeTransition`; filas de una lista -> `useListStaggerTransition`. Los
   toques usan `v-press`, los controles segmentados `useSlidingIndicator`.
8. **Grids con inputs: `minmax(0, 1fr)`, no `1fr`**, y `min-width: 0` en los hijos.
   Con `1fr` la columna no baja de su contenido mínimo y un input se sale de su
   tarjeta (pasó con "Monto" en `DraftReviewCard.vue`).

## Cómo comprobarlo (antes de dar por buena una pantalla)

Cargar la ruta con la API **lenta** (ej. 500ms por request, con
`page.route('**/api/**', ...)` de Playwright) y registrar en cada frame
(`requestAnimationFrame`) el `top`/`height` de los bloques principales; no debe
haber cambios de `height` ni de `top` salvo la animación de entrada (el `y` de
`useStaggerReveal`, 16px, y las aperturas de `useCollapseTransition`).
`PerformanceObserver({ type: 'layout-shift' })` ayuda a detectar el culpable
(`sources[].node`).

Mirar capturas en mitad de la interacción, no solo el estado final.
