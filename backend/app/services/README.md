# app/services/

Acá vive la lógica de negocio real: las reglas de cómo funciona la aplicación, no solo cómo se guarda un dato. Por ejemplo, "no se puede transferir más plata de la que hay" o "borrar una transferencia borra las dos partes, no solo una". Una carpeta por dominio.

## Los errores de cada dominio

Cada carpeta tiene su propio `errors.py` con los errores que puede lanzar (`WalletNotFoundError`, `InsufficientBalanceError`, etc.). Una función de acá lanza estos errores cuando algo sale mal, y no le importa qué código HTTP le corresponde — eso lo decide el router (ver `../routers/README.md`). Gracias a esto se puede probar una función llamándola directo, sin pasar por la API.

## A veces una función toca más de un dominio

La mayoría de las funciones solo tocan su propia carpeta, pero hay casos donde una operación necesita afectar a dos cosas relacionadas a la vez:

- Hacer una transferencia entre billeteras no solo mueve el saldo — también crea dos movimientos en el historial (uno de gasto, uno de ingreso), para que se vea reflejada en Movimientos.
- Borrar un movimiento que es parte de una transferencia borra las dos partes juntas, y revierte el saldo de ambas billeteras — borrar solo una dejaría los números mal.

Cuando pasa esto, el código lo explica con un comentario — nunca es algo hecho "por si acaso".

## Servicios externos que todavía no están conectados

Algunas funciones (tasas de cambio, lectura de recibos con OCR) ya están armadas con la forma correcta, pero todavía no hacen la llamada real a un proveedor externo — falta configurar esas claves. Quedan documentadas así hasta que se conecten de verdad.

## `transactions/drafts/`

Es la parte de transacciones que maneja borradores: un movimiento que viene de una nota de voz o una foto de un recibo, antes de que el usuario lo confirme. Ambos flujos (voz y foto) comparten el mismo código para interpretar el texto y sacar el monto/categoría.

## `devTools/`

No es parte de la aplicación real — crea datos de prueba para el modo demo (`FAKE_DATA_MODE`). Se separó del resto para que quede claro que es solo para desarrollo.
