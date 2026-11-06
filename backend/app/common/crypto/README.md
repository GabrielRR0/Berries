# common/crypto/

`EncryptedString` y `EncryptedDecimal`: tipos de columna que cifran al guardar y
descifran al leer (Fernet, vía `support/crypto_support`), con la clave
`MASTER_ENCRYPTION_KEY`. El resto del código lee un monto normal sin enterarse.

- **Si la clave se pierde, los datos ya guardados quedan ilegibles para siempre**:
  respaldarla aparte de la base.
- Como cada valor se cifra distinto cada vez, ya no se puede sumar ni filtrar por esos
  campos en SQL (por eso `analytics` hace las cuentas en Python). Qué campos van
  cifrados está explicado en cada modelo.
