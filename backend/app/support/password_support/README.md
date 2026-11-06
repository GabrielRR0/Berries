# password_support/

`hash_password(password)` y `verify_password(password, hashed)` con bcrypt. Antes de
bcrypt se pasa la contraseña por SHA-256, porque bcrypt ignora en silencio todo lo que
pase de 72 bytes (ver el docstring de `password.py`).
