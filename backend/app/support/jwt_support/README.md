# jwt_support/

`encode(payload, secret, algorithm)` y `decode(token, secret, algorithm)`. Un token
inválido o vencido lanza `JwtError` (propio, no el de PyJWT). Quien decide qué va en el
token y cuánto dura es `common/security/tokens.py`.
