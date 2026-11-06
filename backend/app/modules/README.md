# modules/

La lógica de negocio, un módulo por carpeta. Todos tienen la misma forma (la referencia
viva es `debts/`):

```
<modulo>/
  __init__.py          API pública: lo único que otros módulos pueden importar
  README.md
  controllers/         las rutas, separadas por quién puede usarlas
    anonymous/           sin sesión                      public_group()
    private/user/        cualquier usuario con sesión    auth_group()
    system/              Vercel Cron                     cron_group()
  contracts/
    dto/                 lo que ENTRA (un modelo por caso, sufijo Dto)
    resources/           lo que SALE (un modelo por respuesta, sufijo Resource)
    enums.py             valores fijos que comparten los dos
  services/
    __init__.py          fachada: controllers y API pública solo hablan con ella
    <tema>/<caso>.py     un archivo por caso de uso, agrupados por tema
  models/              las tablas
  errors.py            errores con su código HTTP
  utils/               funciones puras compartidas
  commands/            comandos de manage.py (cada uno llama a la fachada)
  tests/               pruebas unitarias del módulo
```

Las carpetas aparecen solo si hacen falta. Reglas completas: `docs/CONVENCIONES.md`;
cómo crear un módulo nuevo: `docs/BACKEND-MODULAR.md`.

| Módulo | Qué hace |
|---|---|
| `auth` | registro, login (contraseña y Google), perfil y borrado de cuenta |
| `wallets` | billeteras y transferencias |
| `transactions` | movimientos y borradores por revisar |
| `categories` | categorías por defecto, propias y ocultas |
| `currency` | monedas, tasas de cambio, conversión, historial y cron diario |
| `debts` | deudas, cuotas y abonos |
| `goals` | metas de ahorro y sus aportes |
| `analytics` | resúmenes y comparaciones para la pantalla de Análisis |
| `voice_entry` | registro por voz |
| `receipt_scanner` | lectura de recibos por foto |
| `health` | `/api/health` |
| `dev_tools` | usuario demo (`FAKE_DATA_MODE`) |
