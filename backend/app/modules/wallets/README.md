# Módulo `wallets`

Billeteras y transferencias entre ellas.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/wallets/transfer` | con sesión |
| PATCH | `/api/wallets/transfer/{transfer_id}` | con sesión |
| POST | `/api/wallets` | con sesión |
| GET | `/api/wallets` | con sesión |
| GET | `/api/wallets/{wallet_id}/statement` | con sesión |
| DELETE | `/api/wallets/{wallet_id}` | con sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `CurrencyMismatchError`, `FEE_CATEGORY`, `InsufficientBalanceError`, `Wallet`, `WalletNotFoundError`, `create_wallet`, `execute_transfer`, `get_wallet_owned_by_user`, `list_wallets_for_user`, `wallets_routers`.

## Carpetas

- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
- `models/` — las tablas (SQLAlchemy)
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
- `utils/` — funciones puras que comparten varios services
- `errors.py` — los errores del módulo, cada uno con su código HTTP
