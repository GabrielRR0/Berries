# Berry

Frontend: Vue 3 + Vite (`frontend/`). Backend: FastAPI (`backend/`). Cómo correr: ver `README.md`.

## Convenciones del frontend

- **Modular:** la lógica va en composables (`src/composables/`) y utilidades
  (`src/utils/`); los estilos en archivos `.css` aparte (`<style scoped src="./x.css">`).
  Los `.vue` solo conectan.
- **Animación:** solo con Motion vía `src/animation/` (ver su README). Nadie más
  importa `motion` directo. Respetar `prefers-reduced-motion`.
- **Sin saltos de layout al cargar:** leer `docs/layout-stability.md` antes de
  crear o modificar una pantalla. Resumen: reservar el espacio de lo que llega
  async, animar lo que aparece (`useCollapseTransition`), `scrollbar-gutter`,
  `%` y no `100vw` en elementos fixed.
- **Responsive:** tramos <640 / 640–1023 / ≥1024, probado también a 320px.
- **Verificar la UI mirando capturas** a mitad de la interacción, no solo el final.
- **Color de acento elegible** (Menú > Apariencia): nunca hardcodear rojos (`#ef4444`,
  `rgba(239, 68, 68, x)`); usar `var(--accent)`, `rgba(var(--accent-rgb), x)` y los
  derivados de `style.css`. Cómo se guarda hoy y cómo pasarlo a la DB:
  `docs/accent-color-persistence.md`.
- Berry es dark-only a propósito (ver `frontend/src/style.css`); un solo acento rojo.
