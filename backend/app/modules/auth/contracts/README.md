# contracts/ — auth

Todo lo que entra y sale por HTTP, y nada más. No importa de controllers ni de services (solo al revés).

## `dto/` — lo que ENTRA (body y query, validado por Pydantic)

- `google_check_dto.py` — `GoogleCheckDto`
- `google_login_dto.py` — `GoogleLoginDto`
- `login_dto.py` — `LoginDto`
- `register_user_dto.py` — `RegisterUserDto`
- `wallet_seed_dto.py` — `WalletSeedDto`

## `resources/` — lo que SALE (una clase por respuesta)

- `google_check_resource.py` — `GoogleCheckResource`
- `token_resource.py` — `TokenResource`
- `user_resource.py` — `UserResource`
