# app/schemas/

Define la forma exacta de lo que entra y sale por la API — qué campos vienen en un request, qué devuelve una respuesta. Una carpeta por dominio, igual que en `app/models/`.

## Qué revisa y qué no revisa un schema

Revisa que la forma sea correcta: que un campo sea del tipo esperado, que un texto no sea demasiado largo, que un monto sea mayor a cero. Si algo no cumple, la API responde con un error automáticamente, antes de que se ejecute cualquier lógica.

Lo que NO hace es decidir reglas de negocio. Por ejemplo, "no se puede transferir más plata de la que hay" no es algo que valide un schema — eso lo revisa `app/services/`. Un schema solo sabe que `wallet_id` tiene que ser un identificador válido, no sabe si esa billetera existe o si tiene saldo.

## Por qué los nombres de campo están en snake_case

Los campos usan `wallet_id`, `occurred_at`, etc. (snake_case) porque así habla la API realmente. Es el frontend el que convierte esos nombres a camelCase (`walletId`, `occurredAt`) para usarlos en Vue — no al revés.

## Dos tipos de schema

- Los que reciben datos (terminan en `Request` o `Input`): lo que manda quien llama a la API.
- Los que devuelven datos (terminan en `Response`): lo que la API contesta. Se pueden construir directo a partir de un modelo de la base de datos, sin copiar campo por campo a mano.
