# app/models/

Acá se define cómo se ve cada tabla de la base de datos, como clases de Python. Es la única parte del código que conoce la forma exacta de una fila.

## Una carpeta por dominio

```
models/
├── auth/user_model.py
├── wallets/wallet_model.py
├── transactions/transaction_model.py, transaction_draft_model.py
├── currency/exchange_rate_model.py
├── debts/debt_model.py, installment_model.py
└── shared/column_types.py
```

Un archivo por tabla, una clase por archivo. Las mismas carpetas de dominio se repiten en `app/schemas/`, `app/routers/` y `app/services/` — para entender todo el dominio "debts", por ejemplo, hay que mirar esas cuatro carpetas juntas.

## `shared/column_types.py`

Guarda definiciones de columna que se repiten en varios modelos (un id, una fecha de creación, una referencia a otra tabla), para no escribirlas de cero cada vez. Un modelo solo dice `id: Mapped[UuidPk]` en vez de repetir toda la configuración de esa columna.

## Columnas encriptadas

Algunos campos financieros (montos, categorías, nombres de contraparte) se guardan encriptados en vez de en texto plano. Esto es transparente para el resto del código: leer el campo devuelve el valor real, ya desencriptado. Cada modelo que tiene un campo así lo marca con un comentario explicando qué está encriptado y qué no, y por qué. Más detalle en `app/core/README.md`.

## Relaciones entre tablas

Solo se conectan dos tablas con una relación cuando el código realmente necesita navegar de una a la otra sin hacer una consulta aparte. No se agregan relaciones "por si acaso".

## Los modelos no crean las tablas

Cambiar algo acá no cambia la base de datos real por sí solo — eso lo hace una migración (ver `../../alembic/README.md`). Si se cambia un modelo sin escribir su migración, el código y la base de datos quedan desincronizados.
