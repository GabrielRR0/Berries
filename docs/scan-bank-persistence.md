# Banco de escaneo: cómo se guarda y cómo pasarlo a la DB

## Hoy

- El usuario elige el banco en **Menú > Herramientas > Banco de escaneo** (`/ajustes/banco`).
- La elección se guarda en `localStorage` (`berry_scan_bank`), **por dispositivo**. Todo el acceso
  pasa por `frontend/src/utils/scanBank/scanBankPreferenceStorage.ts`.
- Sin elección, o con un valor que ya no existe, se usa Banco de Venezuela (`DEFAULT_BANK_ID`).
- El composable `frontend/src/composables/screenshotScan/useScanBank.ts` comparte el estado entre
  la pantalla de Ajustes, el menú y el registro desde capturas (`useBulkCapture.ts`), que le pasa
  el banco a `rowsFromImage`. El banco decide qué perfil usa el lector del estado de cuenta
  (`frontend/src/utils/screenshotScan/bankStatement/profiles/`).

## A futuro: guardarlo en la base de datos

Es el mismo patrón que el color principal (ver `accent-color-persistence.md`). La tabla de
usuarios **no tiene columna** para esto todavía:

1. **Backend:** migración (Alembic) que agregue `scan_bank` (`VARCHAR(32)`, `NOT NULL`, default
   `'bdv'`) a `users`; validar contra los ids de los perfiles en el schema Pydantic.
2. **API:** devolver `scan_bank` en `GET /api/auth/me` y en el login, y aceptarlo en un
   `PATCH /api/auth/me`.
3. **Frontend:** reemplazar solo el cuerpo de `scanBankPreferenceStorage.ts` (`load` lee del store
   de auth con `localStorage` como caché; `save` además hace el `PATCH`, con la cola offline si no
   hay red). La pantalla y el composable **no cambian**.
4. Quitar la nota «se guarda en este dispositivo» de la pantalla.

Si más adelante hace falta un banco **por billetera** (varias billeteras en bancos distintos), la
columna iría en `wallets` y `useBulkCapture` tomaría el banco de la billetera elegida en vez de
la preferencia global.
