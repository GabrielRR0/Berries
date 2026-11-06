# crypto_support/

`Cipher(key)` con `encrypt(text)` / `decrypt(token)` (Fernet: AES-128-CBC + HMAC, con IV
aleatorio por valor) y `generate_key()` para crear una `MASTER_ENCRYPTION_KEY` nueva. Lo
usa `common/crypto/` para las columnas cifradas.
