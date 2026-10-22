# Color principal (acento): cómo se guarda y cómo pasarlo a la DB

## Hoy

- El usuario elige el color en **Menú > Apariencia > Color principal** (`/ajustes/color`).
- La elección se guarda en `localStorage` (`berry_accent_color`), **por dispositivo**.
  Todo el acceso pasa por `frontend/src/utils/theme/accentPreferenceStorage.ts`.
- Al arrancar, `main.ts` llama a `initAccentTheme()` (antes de montar la app, sin
  parpadeo) y se aplican las variables CSS sobre `<html>`.
- Paletas: `frontend/src/utils/theme/accentPalettes.ts` (rojo por defecto, azul, cielo,
  verde, rosado, morado). `style.css` deriva el resto de tonos de `--accent-rgb`.

## A futuro: guardarlo en la base de datos

La tabla de usuarios **no tiene columna** para esto todavía. Pasos:

1. **Backend:** migración (Alembic) que agregue `accent_color` (`VARCHAR(16)`, `NOT NULL`,
   default `'red'`) a `users`; validar contra la lista de ids de `accentPalettes.ts`
   (`red | blue | sky | green | pink | purple`) en el schema Pydantic.
2. **API:** devolver `accent_color` en `GET /api/auth/me` y en el login, y aceptarlo en un
   `PATCH /api/auth/me` (o un endpoint de preferencias).
3. **Frontend:** reemplazar el cuerpo de `accentPreferenceStorage.ts`:
   - `load`: leer `user.accentColor` del store de auth al iniciar sesión (mantener
     `localStorage` como caché para aplicar el color antes de que responda la red).
   - `save`: además de `localStorage`, hacer el `PATCH` (con la cola offline si no hay red).
4. La pantalla (`ThemeSettingsMain.vue`) y el composable (`useAccentTheme.ts`) **no cambian**.
5. Quitar la nota "se guarda en este dispositivo" de la pantalla.
